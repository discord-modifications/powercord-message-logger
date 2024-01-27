const { React, getModule, getModuleByDisplayName } = require('powercord/webpack');
const ModuleCard = require('./Card');
const { Toolbar } = require('../icons');

module.exports = class Settings extends React.Component {
   constructor(props) {
      super(props);
   }

   render() {
      const Tab = React.useState('SETTINGS');

      return (
         <>
            <ModuleCard
               id='ml-display-settings'
               name='Display'
               description='8 settings'
               buttonText='View Settings'
               onButtonClick={() => { }}
               hasNextSection={true}
               icon={Toolbar}
               settings={[]}
            />
         </>
      );
   }
};