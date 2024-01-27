const { React, FluxDispatcher, getModule, contextMenu: { openContextMenu, closeContextMenu } } = require('powercord/webpack');
const { getOwnerInstance, findInTree } = require('powercord/util');
const { inject, uninject } = require('powercord/injector');
const { open: openModal } = require('powercord/modal');
const { Tooltip } = require('powercord/components');
const { Plugin } = require('powercord/entities');
const { clipboard } = require('electron');
const { randomBytes } = require('crypto');

const Constants = require('./lib/Constants');
const Cache = require('./lib/Cache');
const Util = require('./lib/Util');

const ToolbarIcon = require('./components/icons/Toolbar');
const Settings = require('./components/settings/Main');
const Modal = require('./components/modals/Logs');

const ContextMenu = getModule(['MenuGroup', 'MenuItem'], false);
const { getCurrentUser } = getModule(['getNullableCurrentUser'], false);
const { fetchMessages } = getModule(['fetchMessages'], false);
const { getUser } = getModule(['getUser', 'getUsers'], false);
const Moment = getModule(['createFromInputFallback'], false);
const { getMessage } = getModule(['getMessages'], false);
const { getChannel } = getModule(['getChannel'], false);
const Messages = getModule(['_channelMessages'], false);

module.exports = class MessageLogger extends Plugin {
   async startPlugin() {
      this.cache = Cache.getLogs();
      this.patches = [];
      this.pendingDispatches = [];
      this.channelMessages = Messages._channelMessages;

      powercord.api.settings.registerSettings(this.entityID, {
         category: this.entityID,
         label: 'Message Logger',
         render: Settings
      });

      this.loadStylesheet('style.scss');
      this.patchToolbar();
      this.patchMessages();
      this.patchContextMenus();

      FluxDispatcher.__dispatch = FluxDispatcher.dispatch;
      FluxDispatcher.dispatch = (args) => {
         if (!args.messageLogger && args.type == 'MESSAGE_DELETE') {
            this.pendingDispatches.push(args);
            return this.processMessageDelete(args);
         }

         if (args.type == 'LOAD_MESSAGES_SUCCESS') {
            const channel = getChannel(args.message ? args.message.channel_id : args.channelId);
            if (args.jump && args.jump.ML2) delete args.jump;
            const deletedMessages = this.cache.deleted[channel.id];
            const purgedMessages = this.cache.purged[channel.id];
            try {
               const recordIDs = [...(deletedMessages || []), ...(purgedMessages || [])];
               const fetchUser = id => getUser(id) || args.messages.find(e => e.author.id === id);
               for (let i = 0, len = recordIDs.length; i < len; i++) {
                  const id = recordIDs[i];
                  if (!this.cache.saved[id]) continue;
                  const message = this.getMessageAny(id);
                  for (let j = 0, len2 = message.mentions.length; j < len2; j++) {
                     const user = message.mentions[j];
                     const cachedUser = fetchUser(user.id || user);
                     if (cachedUser) message.mentions[j] = Util.cleanupUserObject(cachedUser);
                  }
                  const author = fetchUser(message.author.id);
                  if (!author) continue;
                  message.author = Util.cleanupUserObject(author);
               }
            } catch (e) { console.error(e); }
            if (deletedMessages) this.reAddDeletedMessages(args.messages, deletedMessages, !args.hasMoreAfter && !args.isBefore, !args.hasMoreBefore && !args.isAfter);
            if (purgedMessages) this.reAddDeletedMessages(args.messages, purgedMessages, !args.hasMoreAfter && !args.isBefore, !args.hasMoreBefore && !args.isAfter);
         }

         if (args.type == 'MESSAGE_CREATE') {
            this.processMessageCreate(args);
         }

         if (args.type == 'MESSAGE_UPDATE') {
            this.processMessageUpdate(args);
         }

         return FluxDispatcher.__dispatch(args);
      };
   }

   processMessageCreate = ({ message, optimistic, sendMessageOptions }) => {
      // console.log(args, message, optimistic);
      if (sendMessageOptions) return;

      if (!this.cache.sent[message.channel_id]?.some(m => m.id == message.id)) {
         FluxDispatcher.dispatch({
            type: Constants.ActionTypes.PUSH_TO_CATEGORY,
            limit: this.settings.get('sentMessageCap', 1000),
            category: Constants.CategoryTypes.SENT,
            message: Util.cleanupMessageObject(message)
         });
      }
   };

   processMessageUpdate = ({ message }) => {
      FluxDispatcher.dispatch({
         type: Constants.ActionTypes.PUSH_TO_CATEGORY,
         limit: this.settings.get('editedMessageCap', 1000),
         category: Constants.CategoryTypes.EDITED,
         message: Util.cleanupMessageObject(message)
      });
   };

   processMessageDelete = ({ channelId, id }) => {
      let message = this.cache.sent[channelId]?.find(m => m.id == id) ?? getMessage(channelId, id);
      if (message && (message.type == 0 || message.type == 19)) {
         if (this.settings.get('aggresiveCaching', true)) {
            const channelMessages = this.channelMessages[channelId];
            if (!channelMessages || !channelMessages.ready) this.cacheChannelMessages(channelId);
         }
         if (!this.cache.deleted[channelId]) this.cache.deleted[channelId] = [];
         if (!this.cache.deleted[channelId].some(m => m == message.id)) {
            message.delete_data = {
               time: new Date().getTime()
            };

            FluxDispatcher.dispatch({
               type: Constants.ActionTypes.PUSH_TO_CATEGORY,
               limit: this.settings.get('deletedMessageCap', 1000),
               category: Constants.CategoryTypes.DELETED,
               message: Util.cleanupMessageObject(message)
            });

            FluxDispatcher.dispatch({
               type: Constants.ActionTypes.PUSH_TO_CATEGORY,
               limit: this.settings.get('savedMessageCap', 1000),
               category: Constants.CategoryTypes.SAVED,
               message: Util.cleanupMessageObject(message)
            });
         }
         return FluxDispatcher.dispatch({ type: 'ML_UPDATE_MESSAGE', id });
      }
      return FluxDispatcher.dispatch({ type: 'MESSAGE_DELETE', channelId: channelId, id, messageLogger: true });
   };

   cacheChannelMessages(id, relative) {
      fetchMessages({ channelId: id, limit: 50, jump: (relative && { messageId: relative, ML2: true }) || undefined });
   }

   getMessageAny(id) {
      const record = this.cache.saved[id];
      if (!record) return this.cache.sent.find(m => m.id == id);
      return record;
   }

   reAddDeletedMessages(messages, deletedMessages, channelStart, channelEnd) {
      if (!messages.length || !deletedMessages.length) return;
      const DISCORD_EPOCH = 14200704e5;
      const IDs = [];
      const savedIDs = [];
      for (let i = 0, len = messages.length; i < len; i++) {
         const { id } = messages[i];
         IDs.push({ id: id, time: (id / 4194304) + DISCORD_EPOCH });
      }
      for (let i = 0, len = deletedMessages.length; i < len; i++) {
         const id = deletedMessages[i];
         const record = this.cache.saved[id];
         if (!record) continue;
         if (!record.delete_data) {
            this.deleteMessageFromRecords(id);
            continue;
         }
         if (record.delete_data.hidden) continue;
         savedIDs.push({ id: id, time: (id / 4194304) + DISCORD_EPOCH });
      }
      savedIDs.sort((a, b) => a.time - b.time);
      if (!savedIDs.length) return;
      const { time: lowestTime } = IDs[IDs.length - 1];
      const [{ time: highestTime }] = IDs;
      const lowestIDX = channelEnd ? 0 : savedIDs.findIndex(e => e.time > lowestTime);
      if (lowestIDX === -1) return;
      const highestIDX = channelStart ? savedIDs.length - 1 : Util.findLastIndex(savedIDs, e => e.time < highestTime);
      if (highestIDX === -1) return;
      const reAddIDs = savedIDs.slice(lowestIDX, highestIDX + 1);
      reAddIDs.push(...IDs);
      reAddIDs.sort((a, b) => b.time - a.time);
      for (let i = 0, len = reAddIDs.length; i < len; i++) {
         const { id } = reAddIDs[i];
         if (messages.findIndex((e) => e.id === id) !== -1) continue;
         const message = this.cache.saved[id];
         messages.splice(i, 0, message);
      }
      reAddIDs.sort((a, b) => b.time - a.time);

   }

   deleteMessageFromRecords(id) {
      const record = this.cache.saved[id];
      if (!record) {
         for (let map of [this.cache.deleted, this.cache.edited, this.cache.purged]) {
            for (let channelId in map) {
               const index = map[channelId].findIndex(m => m === id);
               if (index == -1) continue;
               map[channelId].splice(index, 1);
               if (!map[channelId].length) delete map[channelId];
            }
         }
         return;
      }

      const channelId = record.message.channel_id;
      for (let map of [this.cache.deleted, this.cache.edited, this.cache.purged]) {
         if (!map[channelId]) continue;
         const index = map[channelId].findIndex(m => m === id);
         if (index == -1) continue;
         map[channelId].splice(index, 1);
         if (!map[channelId].length) delete map[channelId];
      }
      delete this.cache.saved[id];
   }

   async patchMessages() {
      const MessageContent = getModule(m =>
         m.type?.displayName === 'MessageContent' ||
         m.__powercordOriginal_type?.displayName === 'MessageContent', false
      );

      this.patch('ml-message-content', MessageContent, 'type', (args, res) => {
         const forceUpdate = React.useState(0)[1];
         let props = args[0];
         React.useEffect(() => {
            function callback(e) {
               if (!e || !e.id || e.id == props.message.id) forceUpdate({});
            };

            FluxDispatcher.subscribe('ML_UPDATE_MESSAGE', callback);
            return () => {
               FluxDispatcher.unsubscribe('ML_UPDATE_MESSAGE', callback);
            };
         }, [props.message.id, forceUpdate]);

         if (this.settings.get('showEdits', true)) {

         }
         // let msg = this.getEditedMessage(props.message.id, props.message.channel_id);

         // if (msg) {
         //    console.log('c');
         //    console.log(msg);
         // }
         // if (!this.cache.edits[props.message.channel_id] || this.cache.edits[props.message.channel_id].indexOf(props.message.id) === -1) return res;
         // const record = this.cache.sent[props.message.id];
         // if (!record || record.edits_hidden || !Array.isArray(ret.props.children)) return;
         // const createEditedMessage = (edit, editNum, isSingular, noSuffix) =>
         //    ZeresPluginLibrary.DiscordModules.React.createElement(
         //       XenoLib.ReactComponents.ErrorBoundary,
         //       { label: 'Edit history' },
         //       ZeresPluginLibrary.DiscordModules.React.createElement(
         //          Tooltip,
         //          {
         //             text: !!record.delete_data ? null : 'Edited: ' + this.createTimeStamp(edit.time),
         //             position: 'left',
         //             hideOnClick: true
         //          },
         //          _ =>
         //             ZeresPluginLibrary.DiscordModules.React.createElement(
         //                'div',
         //                {
         //                   ..._,
         //                   className: XenoLib.joinClassNames({ [this.style.editedCompact]: props.compact && !isSingular, [this.style.edited]: !isSingular }),
         //                   editNum
         //                },
         //                parseContent({ channel_id: props.message.channel_id, mentionChannels: props.message.mentionChannels, content: edit.content, embeds: [] }).content,
         //                noSuffix
         //                   ? null
         //                   : ZeresPluginLibrary.DiscordModules.React.createElement(SuffixEdited, {
         //                      timestamp: this.tools.createMomentObject(edit.time)
         //                   })
         //             )
         //       )
         //    );
         // ret.props.className = XenoLib.joinClassNames(ret.props.className, this.style.edited);
         // const modifier = this.editModifiers[props.message.id];
         // if (modifier) {
         //    ret.props.children = [createEditedMessage(record.edit_history[modifier.editNum], modifier.editNum, true, modifier.noSuffix)];
         //    return;
         // }
         // const oContent = Array.isArray(ret.props.children[0]) ? ret.props.children[0] : ret.props.children[1];
         // const edits = [];
         // let i = 0;
         // let max = record.edit_history.length;
         // if (this.settings.maxShownEdits) {
         //    if (record.edit_history.length > this.settings.maxShownEdits) {
         //       if (this.settings.hideNewerEditsFirst) {
         //          max = this.settings.maxShownEdits;
         //       } else {
         //          i = record.edit_history.length - this.settings.maxShownEdits;
         //       }
         //    }
         // }
         // for (; i < max; i++) {
         //    const edit = record.edit_history[i];
         //    if (!edit) continue;
         //    let editNum = i;
         //    edits.push(createEditedMessage(edit, editNum));
         // }
         // ret.props.children = [edits, oContent];
         return res;
      });

      MessageContent.type.displayName = 'MessageContent';

      const MemoMessage = getModule(m =>
         (m = m.__powercordOriginal_type ?? m.type) &&
         ~m.toString().indexOf('useContextMenuMessage'), false
      );

      this.patch('ml-memo-message', MemoMessage, 'type', ([{ message, loggerModal }], res) => {
         const forceUpdate = React.useState(0)[1];

         const props = res.props.childrenMessageContent?.props;

         React.useEffect(() => {
            function callback(e) {
               if (!e || !e.id || e.id == message.id) forceUpdate({});
            };

            FluxDispatcher.subscribe('ML_UPDATE_MESSAGE', callback);
            return () => {
               FluxDispatcher.unsubscribe('ML_UPDATE_MESSAGE', callback);
            };
         }, [message.id, forceUpdate]);

         if (!props) return res;

         const deleted = this.cache.deleted[props.message.channel_id]?.find(m => m == props.message.id);
         const record = this.getMessageAny(deleted);
         if (!record || !record.delete_data) return res;

         if (!loggerModal) {
            props.className = [props.className, 'ml-red-tint'].join(' ');
         }

         // res.props.onContextMenu = (event) => openContextMenu(event, this.onDeletedMsgContextMenu.bind(this, message));
         delete res.props.childrenButtons;

         return (
            <Tooltip
               position='left'
               text={`Deleted: ${Moment(record.delete_data.time).format('LLLL')}`}
            >
               {res}
            </Tooltip>
         );
      });

      this.forceUpdateMessages();
   }

   forceUpdateMessages() {
      const classes = getModule(['chat', 'content'], false);
      const element = document.querySelector(`.${classes.chat} .${classes.content}`);
      if (!element) return;

      const chat = getOwnerInstance(element);
      if (!chat) return;

      const _this = this;
      this.patch('shc-force-update-messages', chat.__proto__, 'render', function (args, res) {
         _this.unpatch('shc-force-update-messages');

         res.key = randomBytes(16).toString('hex');
         res.ref = () => this.forceUpdate();

         return res;
      });

      chat.forceUpdate?.();
   }

   onDeletedMsgContextMenu(message) {
      return (
         <ContextMenu.default onClose={closeContextMenu}>
            <ContextMenu.MenuItem
               label='Copy Text' id='ctext'
               action={() => clipboard.writeText(message.content)}
            />
            <ContextMenu.MenuItem
               label='Copy ID' id='cid'
               action={() => clipboard.writeText(message.id)}
            />
            <ContextMenu.MenuItem
               label='Logger' id='logger'
            >
               <ContextMenu.MenuItem
                  label='Remove from Log' id='remove-from-log'
                  color='colorDanger'
                  action={() => {
                     FluxDispatcher.dispatch({
                        type: 'MESSAGE_DELETE',
                        messageLogger: true,
                        channelId: message.channel_id,
                        id: message.id
                     });
                  }}
               />
            </ContextMenu.MenuItem>
         </ContextMenu.default>
      );
   }

   async patchToolbar() {
      const HeaderBarContainer = getModule(m => m.default?.displayName == 'HeaderBarContainer', false);

      this.patch('ml-header-bar', HeaderBarContainer.default.prototype, 'render', (_, res) => {
         let toolbar = res.props.toolbar;
         if (toolbar) {
            const children = toolbar.props.children;
            const index = children?.indexOf(children.find(i => i?.props?.className?.includes('search')));

            if (index > -1) children.splice(index, 0,
               <ToolbarIcon onClick={() => openModal(() => <Modal cache={this.cache} />)} />
            );
         }

         return res;
      });

      HeaderBarContainer.default.displayName = 'HeaderBarContainer';

      const classes = getModule(['title', 'chatContent'], false);
      const toolbar = document.querySelector(`.${classes.title}`);

      if (toolbar) {
         console.log(getOwnerInstance(toolbar));
         getOwnerInstance(toolbar)?.forceUpdate?.();
      }
   }

   async patchContextMenus() {
      const GuildContextMenu = getModule(m => m.default?.displayName == 'GuildContextMenu', false);

      this.patch('ml-guild-context', GuildContextMenu, 'default', (args, res) => {
         return res;
      });

      GuildContextMenu.default.displayName = 'GuildContextMenu';
   }

   pluginWillUnload() {
      FluxDispatcher.dispatch = FluxDispatcher.__dispatch;
      for (const dispatch of this.pendingDispatches) FluxDispatcher.dispatch(dispatch);
      for (const patch of this.patches) uninject(patch);
      powercord.api.settings.unregisterSettings(this.entityID);
   }

   patch(...args) {
      if (!args || !args[0] || typeof args[0] !== 'string') return;
      if (args[1] == true) {
         uninject(args[0]);
         let index = this.patches.indexOf(args[0]);
         if (!index) return;
         return this.patches.splice(index, 1);
      }
      if (!this.patches) this.patches = [];
      this.patches.push(args[0]);
      return inject(...args);
   }

   unpatch(id) {
      uninject(id);
      let index = this.patches.indexOf(id);
      if (!index) return;
      return this.patches.splice(index, 1);
   }
};