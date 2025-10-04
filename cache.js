class Caching {
  constructor() {
    this.invites = new Map(); // Map<guildId, Map<inviteCode, { inviterId, uses }>>
  }

  addItem(guildId, inviteCode, inviterId, uses) {
    if (!this.invites.has(guildId)) this.invites.set(guildId, new Map());
    this.invites.get(guildId).set(inviteCode, { inviterId, uses });
  }

  getGuildInvites(guildId) {
    return this.invites.get(guildId) || new Map();
  }

  updateInvite(guildId, inviteCode, uses) {
    if (this.invites.has(guildId)) {
      const invite = this.invites.get(guildId).get(inviteCode);
      if (invite) invite.uses = uses;
    }
  }

  removeGuild(guildId) {
    this.invites.delete(guildId);
  }
}

module.exports = new Caching();
