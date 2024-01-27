const { Text, TabBar, FormTitle, Icon, Button, Tooltip } = require('powercord/components');
const { close: closeModal, open: openModal } = require('powercord/modal');
const { React, getModule, FluxDispatcher } = require('powercord/webpack');
const { Modal, Confirm } = require('powercord/components/modal');
const { header } = getModule(['tabBarContainer'], false);
const { ActionTypes, ModalTabs } = require('../../lib/Constants');

const classes = getModule(['tabBarContainer'], false);
const { extractAll, getLength } = require('../../lib/Util');
const Message = require('../partials/ChatMessage');
const Banana = require('../partials/NoResults');

module.exports = class extends React.Component {
   constructor(props) {
      super(props);

      this.cache = props.cache;
      this.state = {
         selectedTab: 'sent',
         sortDirection: true,
         renderedMsgs: 50
      };
   }

   render() {
      return (
         <React.Fragment>
            <Modal size={Modal.Sizes.LARGE}>
               {this.renderHeader()}
               {this.renderTabs()}
               {this.renderContent()}
               {this.renderFooter()}
            </Modal>
         </React.Fragment>
      );
   }

   renderHeader() {
      return (
         <Modal.Header className={header}>
            <FormTitle tag='h1' className='logs-header'>
               Logs
            </FormTitle>
            <Modal.CloseButton onClick={closeModal} />
         </Modal.Header>
      );
   }

   renderTabs() {
      const { selectedTab } = this.state;

      return (
         <div className={classes.tabBarContainer}>
            <TabBar
               className={classes.tabBar}
               selectedItem={selectedTab}
               type={TabBar.Types.TOP}
               onItemSelect={(v) => {
                  this.setState({ selectedTab: v });
                  this.setState({ renderedMsgs: 50 });
               }}
            >
               {ModalTabs.map((tab) => (
                  <TabBar.Item
                     className={classes.tabBarItem}
                     id={tab.id}
                  >
                     {tab.title} ({this.cache[tab.id].length ?? getLength(this.cache[tab.id])})
                  </TabBar.Item>
               ))}
            </TabBar>
         </div>
      );
   }

   renderContent() {
      let data = this.cache[this.state.selectedTab];
      data = typeof data == 'object' && !Array.isArray(data) ? extractAll(data) : [...data];

      let lastMessage;
      let startMsg;

      data = data
         // .sort((a, b) => this.state.sortDirection ? b.id - a.id : a.id - b.id)
         .splice(0, this.state.renderedMsgs)
         .map((m) => {
            if (typeof m == 'string') m = this.cache.saved[m];
            if (!m) return;

            const isStart = (
               !startMsg ||
               !lastMessage ||
               lastMessage.channel_id != m.channel_id ||
               lastMessage.author.id != m.author.id ||
               new Date(m.timestamp).getDate() !== new Date(lastMessage.timestamp).getDate()
            );
            if (isStart) startMsg = m;
            lastMessage = { ...m, groupId: isStart ? m.id : startMsg.id };

            return <Message message={m} isStart={isStart} groupId={lastMessage.groupId} />;
         })
         .filter(Boolean);

      return (
         <Modal.Content className='ml-modal-content'>
            {data.length ? data : <Banana />}

            {data.length > 50 ?
               <div className='ml-load-more-messages'>
                  <Button
                     color={Button.Colors.BRAND}
                     onClick={() => this.setState({
                        renderedMsgs: this.state.renderedMsgs + 50
                     })}
                  >
                     Load more messages
                  </Button>
               </div> : ''
            }
         </Modal.Content>
      );
   }

   renderFooter() {
      return (
         <Modal.Footer>
            <Button
               color={Button.Colors.RED}
               disabled={getLength(this.cache[this.state.selectedTab]).length <= 0}
               onClick={() => {
                  openModal(() =>
                     <Confirm
                        red={true}
                        header='Clear Logs'
                        confirmText='Clear'
                        cancelText='Cancel'
                        onCancel={closeModal}
                        onConfirm={() => {
                           FluxDispatcher.dispatch({
                              type: ActionTypes.WIPE_LOGS,
                              category: this.state.selectedTab
                           });
                        }}
                     >
                        <Text color={Text.Colors.PRIMARY} size={Text.Sizes.LARGE}>
                           Are you sure you want to clear your logs in {this.state.selectedTab}?
                        </Text>
                     </Confirm>
                  );
               }}
            >
               Clear Logs
            </Button>
            <div className='sort-button-container ml-display-left'>
               <Button
                  className='sort-button-icon'
                  color={Button.Colors.TRANSPARENT}
                  onClick={() => this.setState({ sortDirection: !this.state.sortDirection })}>
                  {this.state.sortDirection ?
                     <Tooltip text='New to Old' position='top'>
                        <Icon name='ArrowDropDown' />
                     </Tooltip>
                     :
                     <Tooltip text='Old to New' position='top'>
                        <Icon name='ArrowDropUp' />
                     </Tooltip>
                  }
               </Button>
            </div>
         </Modal.Footer>
      );
   }
};