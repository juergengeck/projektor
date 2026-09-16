/**
 * Contracted chat actions for the Amway workspace (slice 6).
 *
 * Conversations start from an effective phonebook contract resolved through
 * the department directory. This module owns admission (contract, purpose,
 * participants, object audience) — never transport, which stays with the
 * native trie/CHUM owners. A send request is recorded with pending receipt:
 * it is never proof of peer receipt. Topic membership never widens an
 * object's audience; every shared object needs its own audience check with
 * an exact reference.
 */

function fail(message) {
  throw new Error(message);
}

export class AmwayChatActions {
  constructor({ directory, now = () => Date.now() } = {}) {
    if (!directory || typeof directory.authorize !== "function") {
      fail("Amway chat actions require the department directory.");
    }
    this.directory = directory;
    this.now = now;
    this.conversations = new Map();
    this.grants = [];
    this.serial = 0;
  }

  startConversation({ subject, contact, department, topic, atTime } = {}) {
    const at = atTime ?? this.now();
    this.directory.authorize({ subject, action: "chat.send", department, contact, atTime: at });
    if (typeof topic !== "string" || topic.length === 0) fail("Amway conversation requires a topic.");
    this.serial += 1;
    const conversation = {
      id: `chat-${this.serial}`,
      participants: [subject, contact],
      department, topic,
      contract: this.directory.effectiveContract({ holder: subject, contact, department, atTime: at })?.id ??
        this.directory.effectiveContract({ holder: contact, contact: subject, department, atTime: at })?.id,
      openedAt: at, receipt: "pending-transport",
    };
    this.conversations.set(conversation.id, conversation);
    return { ...conversation };
  }

  shareObject({ subject, contact, department, conversation: id, objectRef, audience, atTime } = {}) {
    const at = atTime ?? this.now();
    const conversation = this.conversations.get(id);
    if (!conversation) fail(`Amway unknown conversation ${id}.`);
    if (!conversation.participants.includes(subject) || !conversation.participants.includes(contact)) {
      fail(`Amway conversation ${id} does not include both parties.`);
    }
    this.directory.authorize({ subject, action: "chat.send", department, contact, atTime: at });
    if (typeof objectRef !== "string" || objectRef.length === 0) {
      fail("Amway object shares require an exact reference.");
    }
    if (!Array.isArray(audience) || !audience.includes(contact)) {
      fail("Amway object shares require the recipient in the object audience.");
    }
    const grant = { conversation: id, objectRef, sharedBy: subject, audience: [...audience], sharedAt: at };
    this.grants.push(grant);
    return { ...grant };
  }

  grantsFor(conversation) {
    return this.grants.filter(grant => grant.conversation === conversation).map(grant => ({ ...grant }));
  }
}
