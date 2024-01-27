const { join } = require('path');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const { SETTINGS_FOLDER } = require('powercord/constants');
const { Flux, FluxDispatcher } = require('powercord/webpack');
const { ActionTypes, DefaultCache } = require('./constants');
const logsPath = join(SETTINGS_FOLDER, '/ML_Logs.json');

if (!existsSync(logsPath)) {
   writeFileSync(logsPath, JSON.stringify(DefaultCache));
}

let logs = (() => {
   try {
      let data = JSON.parse(readFileSync(logsPath), 'utf8');

      if (!data.sent) data.sent = [];
      if (!data.deleted) data.deleted = {};
      if (!data.edited) data.edited = {};
      if (!data.purged) data.purged = {};
      if (!data.ghost) data.ghost = {};
      if (!data.saved) data.saved = {};

      return data;
   } catch (e) {
      return DefaultCache;
   }
})();

class SettingsStore extends Flux.Store {
   constructor(Dispatcher, handlers) {
      super(Dispatcher, handlers);

      this._persist = global._.debounce(this._persist.bind(this), 1000);
      this.addChangeListener(this._persist);
   }

   getLogs() {
      return logs;
   }

   _persist() {
      let data = {};
      Object.keys(logs).map(type => {
         if (type == 'sent') return;
         data[type] = { ...logs[type] };
      });

      data = JSON.stringify(data, null, 3);

      writeFileSync(logsPath, data);
   }
}

module.exports = new SettingsStore(FluxDispatcher, {
   [ActionTypes.PUSH_TO_CATEGORY]: ({ category, message, limit }) => {
      if (!message.channel_id) return;

      if (category == 'sent') return logs.sent.push(message);
      if (category == 'saved') return logs.saved[message.id] = message;

      let Logs = logs[category][message.channel_id];
      if (!Logs?.some(m => m.id == message.id)) {
         if (!Logs) Logs = logs[category][message.channel_id] = [];
         logs[category][message.channel_id].push(message.id);
      }
   },

   [ActionTypes.WIPE_LOGS]: ({ category }) => {
      if (category == 'all') {
         return logs = DefaultCache;
      } else if (category == 'sent') {
         return logs.sent = [];
      } else if (category == 'deleted' || category == 'all') {
         for (const channel in logs.deleted) {
            for (const message of logs.deleted[channel]) {
               setImmediate(() => FluxDispatcher.dispatch({
                  type: 'MESSAGE_DELETE',
                  channelId: channel,
                  id: message,
                  messageLogger: true
               }));
            }
         }
      }

      logs[category] = {};
   },
});