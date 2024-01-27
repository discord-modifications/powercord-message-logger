const { getModule } = require('powercord/webpack');

const { getMessage } = getModule(['getMessage'], false);

module.exports = class Util {
   static extractAll(object) {
      let res = [];
      Object.keys(object).forEach(c => {
         let messages = object[c];
         res.push(...messages);
      });
      return res;
   }

   static getLength(object) {
      return Object.values(object).reduce((a, b) => a + b.length, 0);
   }

   static compareIds(cache, cid, id) {
      return [cache.sent[cid]?.some(m => m.id === id), () => cache.sent[cid]?.find(m => m.id === id)];
   }

   static cleanupMessageObject(message) {
      const ret = {
         mention_everyone: typeof message.mention_everyone !== 'boolean' ? typeof message.mentionEveryone !== 'boolean' ? false : message.mentionEveryone : message.mention_everyone,
         edited_timestamp: message.edited_timestamp || message.editedTimestamp && new Date(message.editedTimestamp).getTime() || null,
         attachments: message.attachments || [],
         channel_id: message.channel_id,
         message_id: message.message_id,
         reactions: (message.reactions || []).map(e => (!e.emoji.animated && delete e.emoji.animated, !e.me && delete e.me, e)),
         guild_id: message.guild_id,
         content: message.content,
         type: message.type,
         embeds: message.embeds || [],
         author: Util.cleanupUserObject(message.author),
         mentions: message.mentions,
         mention_roles: message.mention_roles || message.mentionRoles || [],
         id: message.id,
         flags: message.flags,
         timestamp: new Date(message.timestamp).getTime(),
         referenced_message: null,
         delete_data: message.delete_data
      };

      if (ret.type === 19) {
         ret.message_reference = message.message_reference || message.messageReference;
         if (ret.message_reference) {
            if (message.referenced_message) {
               ret.messageReference = message.referenced_message;
            } else if (getMessage(ret.message_reference.channel_id, ret.message_reference.message_id)) {
               ret.messageReference = getMessage(ret.message_reference.channel_id, ret.message_reference.message_id);
            }
         }
      }

      return ret;
   }

   static cleanupUserObject(user) {
      if (!user) return null;
      return {
         discriminator: user.discriminator,
         username: user.username,
         avatar: user.avatar,
         id: user.id,
         bot: user.bot,
         public_flags: typeof user.publicFlags !== 'undefined' ? user.publicFlags : user.public_flags
      };
   }

   static findLastIndex(array, predicate) {
      let l = array.length;
      while (l--) if (predicate(array[l], l, array)) return l;
      return -1;
   }
};