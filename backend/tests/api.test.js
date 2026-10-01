const fs = require('fs').promises;
const { createMessage, initializeStorage, getMessagesBetweenUsers } = require('../src/models/fileStorage');

// Mock file system globally
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    open: jest.fn(),
    rename: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn()
  },
  constants: { W_OK: 2 }
}));

describe('Storage Persistence Integrity', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATA_DIR = './test-data';
    
    // Mock initial empty DB read
    fs.readFile.mockResolvedValue('[]');
    fs.access.mockResolvedValue(true);
    fs.open.mockResolvedValue({
      writeFile: jest.fn().mockResolvedValue(),
      sync: jest.fn().mockResolvedValue(),
      close: jest.fn().mockResolvedValue()
    });
  });

  it('rolls back memory cache if disk write fails', async () => {
    await initializeStorage();
    
    // Force the atomic rename (the actual commit step to disk) to fail
    fs.rename.mockRejectedValueOnce(new Error('Simulated Disk Failure'));

    const msg = { senderId: 'user1', receiverId: 'user2', content: 'hello' };
    
    // The request should throw an error to the user
    await expect(createMessage(msg)).rejects.toThrow('Cannot write');

    // Crucially: The memory cache must NOT contain the message
    const messages = await getMessagesBetweenUsers('user1', 'user2');
    expect(messages.length).toBe(0);
  });

  it('keeps queue functional after a failure', async () => {
    await initializeStorage();
    
    // Fail first write, succeed second write
    fs.rename
      .mockRejectedValueOnce(new Error('Simulated Disk Failure'))
      .mockResolvedValueOnce(undefined);

    const msg1 = { senderId: 'user1', receiverId: 'user2', content: 'failed msg' };
    const msg2 = { senderId: 'user1', receiverId: 'user2', content: 'successful msg' };

    await expect(createMessage(msg1)).rejects.toThrow('Cannot write');
    await expect(createMessage(msg2)).resolves.toBeDefined();

    const messages = await getMessagesBetweenUsers('user1', 'user2');
    expect(messages.length).toBe(1);
    expect(messages[0].content).toBe('successful msg');
  });
});
