const { React } = require('powercord/webpack');

module.exports = React.memo(
   (props) => {
      const filteredProps = ((props, filter) => {
         if (props) {
            const newProps = { ...props };

            filter.forEach(prop => delete newProps[prop]);

            return newProps;
         }

         return {};
      })(props, ['width', 'height', 'color', 'foreground']);

      return <svg
         {...filteredProps}
         aria-hidden={props['aria-hidden'] ?? false}
         width={props.width ?? 24}
         height={props.height ?? 24}
         viewBox='0 0 24 24'
      >
         <g fill='none' fill-rule='evenodd'>
            <polygon className={props.foreground} fill={props.color ?? 'currentColor'} fill-rule='nonzero' points='8.47 2 6.12 4.35 13.753 12 6.12 19.65 8.47 22 18.47 12' />
            <polygon points='0 0 24 0 24 24 0 24' />
         </g>
      </svg>;
   }
);
