const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require("@firebase/rules-unit-testing");
const { test, before, after, beforeEach } = require("node:test");
const fs = require("node:fs");

let testEnv;
const PROJECT_ID = "demo-no-project";
const ALICE_UID = "alice_123";
const BOB_UID = "bob_456";

const [emulatorHost, emulatorPortStr] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085").split(":");
const emulatorPort = parseInt(emulatorPortStr, 10);

before(async () => {
  const rules = fs.readFileSync("./firestore.rules", "utf8");
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: emulatorHost,
      port: emulatorPort,
    },
  });
});

after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

beforeEach(async () => {
  if (testEnv) {
    await testEnv.clearFirestore();
  }
});

test("Unauthenticated user: cannot read users or messages", async () => {
  const unauthDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(unauthDb.collection("users").get());
  await assertFails(unauthDb.collection("messages").get());
});

test("Authenticated user: can create their own profile", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertSucceeds(
    aliceDb.collection("users").doc(ALICE_UID).set({
      id: ALICE_UID,
      username: "alice_user",
      fullName: "Alice Wonderland",
      isOnline: true,
      createdAt: new Date(),
    })
  );
});

test("Authenticated user: cannot create another user's profile", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertFails(
    aliceDb.collection("users").doc(BOB_UID).set({
      id: BOB_UID,
      username: "bob_user",
      fullName: "Bob Builder",
      isOnline: true,
      createdAt: new Date(),
    })
  );
});

test("Authenticated user: can read other users in directory", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("users").doc(BOB_UID).set({
      id: BOB_UID,
      username: "bob_user",
      fullName: "Bob Builder",
      isOnline: true,
      createdAt: new Date(),
    });
  });

  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertSucceeds(aliceDb.collection("users").doc(BOB_UID).get());
});

test("Authenticated user: can send direct message to another user", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertSucceeds(
    aliceDb.collection("messages").doc("msg_123").set({
      id: "msg_123",
      senderId: ALICE_UID,
      receiverId: BOB_UID,
      content: "Hello Bob!",
      read: false,
      createdAt: new Date(),
    })
  );
});

test("Authenticated user: cannot send message as another user", async () => {
  const aliceDb = testEnv.authenticatedContext(ALICE_UID).firestore();
  await assertFails(
    aliceDb.collection("messages").doc("msg_fake").set({
      id: "msg_fake",
      senderId: BOB_UID,
      receiverId: ALICE_UID,
      content: "Impersonated message",
      read: false,
      createdAt: new Date(),
    })
  );
});

test("Recipient: can mark received message as read", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("messages").doc("msg_456").set({
      id: "msg_456",
      senderId: ALICE_UID,
      receiverId: BOB_UID,
      content: "Hey Bob!",
      read: false,
      createdAt: new Date(),
    });
  });

  const bobDb = testEnv.authenticatedContext(BOB_UID).firestore();
  await assertSucceeds(
    bobDb.collection("messages").doc("msg_456").update({
      read: true,
    })
  );
});

test("Third party: cannot read message between Alice and Bob", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().collection("messages").doc("msg_secret").set({
      id: "msg_secret",
      senderId: ALICE_UID,
      receiverId: BOB_UID,
      content: "Top secret",
      read: false,
      createdAt: new Date(),
    });
  });

  const charlieDb = testEnv.authenticatedContext("charlie_789").firestore();
  await assertFails(charlieDb.collection("messages").doc("msg_secret").get());
});
