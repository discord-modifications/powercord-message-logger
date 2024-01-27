const { React } = require('powercord/webpack');

module.exports = (initialValue = false) => {
   const [value, setValue] = React.useState(initialValue);
   const toggle = React.useCallback(() => {
      setValue(v => !v);
   }, []);
   return [value, toggle];
};