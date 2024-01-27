exports.ActionTypes = Object.freeze({
   PUSH_TO_CATEGORY: 'ML_PUSH_TO_CATEGORY',
   WIPE_LOGS: 'ML_WIPE_LOGS'
});

exports.CategoryTypes = Object.freeze({
   DELETED: 'deleted',
   SENT: 'sent',
   EDITED: 'edited',
   SAVED: 'saved'
});

exports.DefaultCache = {
   saved: {},
   sent: [],
   deleted: {},
   edited: {},
   purged: {},
   ghost: {}
};

exports.ModalTabs = [
   {
      title: 'Sent',
      id: 'sent'
   },
   {
      title: 'Deleted',
      id: 'deleted'
   },
   {
      title: 'Edited',
      id: 'edited'
   },
   {
      title: 'Purged',
      id: 'purged'
   },
   {
      title: 'Ghost Pings',
      id: 'ghost'
   }
];