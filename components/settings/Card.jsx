const { React, getModule, getModuleByDisplayName } = require('powercord/webpack');
const { Card, Clickable, Flex, Text } = require('powercord/components');
const { RightCaret } = require('../icons');

const { default: Button } = getModule(['ButtonLink'], false);

const IntegrationInfo = getModuleByDisplayName('IntegrationInfo', false);
const classes = getModule(['card', 'clickable'], false);

class SettingsCard extends React.PureComponent {
   renderButton({ buttonText, buttonDisabled, hasNextSection, onButtonClick }) {
      if (!buttonText || !onButtonClick) {
         return null;
      }

      if (hasNextSection) {
         return <Flex align={Flex.Align.CENTER}>
            <Text>{buttonText}</Text>
            {hasNextSection ? <RightCaret width={10} height={10} className={classes.caret} /> : null}
         </Flex>;
      }

      return <Button
         size={Button.Sizes.SMALL}
         look={Button.Looks[hasNextSection ? 'LINK' : 'FILLED']}
         color={Button.Colors[hasNextSection ? 'PRIMARY' : 'BRAND']}
         disabled={buttonDisabled}
         onClick={onButtonClick}
      >
         {buttonText}
      </Button>;
   }

   render() {
      return <Flex>
         <IntegrationInfo {...this.props} />

         <Flex.Child shrink={0} grow={0}>
            <Flex align={Flex.Align.CENTER} justify={Flex.Justify.END}>
               {this.renderButton(this.props)}
            </Flex>
         </Flex.Child>
      </Flex>;
   }
}

module.exports = React.memo(props => {
   const [focused, setFocused] = React.useState(false);

   if (props.hasNextSection) {
      return <Clickable onClick={props.onButtonClick} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
         <Card editable={true} className={['ml-settings-card', classes.card, classes.clickable].join(' ')}>
            <SettingsCard {...props} focused={focused} />
         </Card>
      </Clickable>;
   }

   return <Card editable={true} className={['ml-settings-card', classes.card].join(' ')}>
      <SettingsCard {...props} focused={focused} />
   </Card>;
});
