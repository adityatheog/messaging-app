const express = require('express');
const authMiddleware = require('../middleware/auth');
const { getStore } = require('../storage');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const store = getStore();
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const users = q
      ? await store.searchUsers(q, req.user.id)
      : (await store.getUsers()).filter((u) => u.id !== req.user.id);

    const sanitized = users.map(({ password: _password, ...u }) => u);
    res.json(sanitized);
  } catch (error) {
    console.error('Users fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/contacts', authMiddleware, async (req, res) => {
  try {
    const contacts = await getStore().getContacts(req.user.id);
    res.json(contacts);
  } catch (error) {
    console.error('Contacts fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

router.post('/contacts', authMiddleware, async (req, res) => {
  try {
    const { contactId } = req.body || {};
    if (typeof contactId !== 'string' || !contactId.trim()) {
      return res.status(400).json({ error: 'Contact ID is required' });
    }
    const cleanId = contactId.trim();
    if (cleanId === req.user.id) {
      return res.status(400).json({ error: 'You cannot add yourself as a contact' });
    }
    const contact = await getStore().addContact(req.user.id, cleanId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact user not found' });
    }
    res.status(201).json({ message: 'Contact added', contact });
  } catch (error) {
    console.error('Add contact error:', error.message);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

router.delete('/contacts/:contactId', authMiddleware, async (req, res) => {
  try {
    const removed = await getStore().removeContact(req.user.id, req.params.contactId);
    if (!removed) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ message: 'Contact removed' });
  } catch (error) {
    console.error('Remove contact error:', error.message);
    res.status(500).json({ error: 'Failed to remove contact' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await getStore().findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { password: _password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
  } catch (error) {
    console.error('User fetch error:', error.message);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
