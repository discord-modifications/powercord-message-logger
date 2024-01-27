const { React, getModule, getModuleByDisplayName, contextMenu: { openContextMenu, closeContextMenu } } = require('powercord/webpack');
const { close: closeModal } = require('powercord/modal');
const { clipboard } = require('electron');

const ChannelMessage = getModule(m => (m = m.__powercordOriginal_type ?? m.type) && ~m.toString().indexOf('useContextMenuMessage'), false);
const Message = getModule(m => m.prototype?.getReaction && m.prototype.isSystemDM, false);
const Timestamp = getModule(m => m.prototype?.toDate && m.prototype.month, false);
const transitionTo = getModule(['transitionTo'], false).transitionTo;
const ContextMenu = getModule(['MenuGroup', 'MenuItem'], false);
const { sanitizeEmbed } = getModule(['sanitizeEmbed'], false);
const { getChannel } = getModule(['getChannel'], false);
const { getGuild } = getModule(['getGuild'], false);
const User = getModule(m => m.prototype?.tag, false);

module.exports = ({ message, groupId, modal }) => {
   return (
      <div
         className='logged-message'
         onContextMenu={event => {
            return openContextMenu(event, () =>
               <LoggerContextMenu
                  message={message}
                  modal={modal}
               />
            );
         }}
      >
         <ChannelMessage
            id={`chat-messages-${message.id}`}
            groupId={groupId}
            loggerModal={true}
            message={new Message({
               ...message,
               author: new User({ ...message.author }),
               timestamp: new Timestamp(new Date(message.timestamp)),
               embeds: message.embeds.map(e => sanitizeEmbed(null, null, e.timestamp ? { ...e, timestamp: new Timestamp(new Date(e.timestamp)) } : e))
            })}
            channel={getChannel(message.channel_id)}
            guild={getGuild(message?.guild_id)}
         />
      </div>
   );
};

const LoggerContextMenu = ({ message }) => {
   return <>
      <ContextMenu.default onClose={closeContextMenu}>
         <ContextMenu.MenuItem
            label='Jump to Message' id='jump'
            action={() => {
               transitionTo(`/channels/${message.guild_id ?? '@me'}/${message.channel_id}/${message.id}`);
               closeModal();
            }}
         />
         <ContextMenu.MenuItem
            label='Copy Text' id='ctext'
            action={() => clipboard.writeText(message.content)}
         />
         <ContextMenu.MenuItem
            label='Copy ID' id='cid'
            action={() => clipboard.writeText(message.id)}
         />
      </ContextMenu.default>
   </>;
};