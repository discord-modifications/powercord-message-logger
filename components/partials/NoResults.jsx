const { React, getModule } = require('powercord/webpack');
const classes = getModule(['emptyResultsWrap'], false);

module.exports = () => {
   return (
      <div className={classes.emptyResultsWrap}>
         <div className={classes.emptyResultsContent} style={{ paddingBottom: '0px' }}>
            <div className={classes.noResultsImage} />
            <div className={classes.emptyResultsText}>
               No messages were found in this section.
            </div>
         </div>
      </div>
   );
};