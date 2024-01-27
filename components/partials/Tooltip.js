const { getModule } = require('powercord/webpack');

const Classes = {
   Layers: getModule(['layer', 'disabledPointerEvents'], false),
   Tooltip: getModule(['tooltip'], false),
   Timestamp: getModule(['timestampTooltip'], false),
   Popouts: getModule(['popouts'], false).popouts
};

const getClass = function (sideOrColor) {
   const upperCase = sideOrColor[0].toUpperCase() + sideOrColor.slice(1);
   const tooltipClass = Classes.Tooltip[`tooltip${upperCase}`];
   if (tooltipClass) return tooltipClass;
   return null;
};

const classExists = function (sideOrColor) {
   return !!getClass(sideOrColor);
};

const toPx = function (value) {
   return `${value}px`;
};

module.exports = class Tooltip {
   classes = Classes;
   /**
    * @constructor
    * @param {HTMLElement} node - DOM node to monitor and show the tooltip on
    * @param {string} tip - string to show in the tooltip
    * @param {object} options - additional options for the tooltip
    * @param {string} [options.style=black] - correlates to the discord styling/colors (black, brand, green, grey, red, yellow)
    * @param {string} [options.side=top] - can be any of top, right, bottom, left
    * @param {boolean} [options.preventFlip=false] - prevents moving the tooltip to the opposite side if it is too big or goes offscreen
    * @param {boolean} [options.isTimestamp=false] - adds the timestampTooltip class (disables text wrapping)
    * @param {boolean} [options.disablePointerEvents=false] - disables pointer events
    * @param {boolean} [options.disabled=false] - whether the tooltip should be disabled from showing on hover
    */
   constructor(node, text, options = {}) {
      const {
         style = 'black',
         side = 'top',
         preventFlip = false,
         isTimestamp = false,
         disablePointerEvents = false,
         disabled = false
      } = options;

      if (!node?.innerHTML) return console.log('invalid node');
      this.node = node;
      this.label = text;
      this.style = style.toLowerCase();
      this.side = side.toLowerCase();
      this.preventFlip = preventFlip;
      this.isTimestamp = isTimestamp;
      this.disablePointerEvents = disablePointerEvents;
      this.isDisabled = disabled;
      this.active = false;

      if (!classExists(this.side)) return console.log(`Side ${this.side} does not exist.`);
      if (!classExists(this.style)) return console.log(`Style ${this.style} does not exist.`);

      this.element = this.createElement(`<div class="${Classes.Layers.layer}">`);
      this.tooltipElement = this.createElement(`<div class="${Classes.Tooltip.tooltip} ${getClass(this.style)}"><div class="${Classes.Tooltip.tooltipPointer}"></div><div class="${Classes.Tooltip.tooltipContent}">${this.label}</div></div>`);
      this.labelElement = this.tooltipElement.childNodes[1];
      this.element.append(this.tooltipElement);

      if (this.disablePointerEvents) {
         this.element.classList.add(Classes.Layers.disabledPointerEvents);
         this.tooltipElement.classList.add(Classes.Tooltip.tooltipDisablePointerEvents);
      }
      if (this.isTimestamp) this.tooltipElement.classList.add(Classes.Timestamp.timestampTooltip);


      this.node.addEventListener('mouseenter', () => {
         if (this.disabled) return;
         this.show();
      });

      this.node.addEventListener('mouseleave', () => {
         this.hide();
      });
   }

   get disabled() {
      if (typeof this.isDisabled == 'function') {
         return Boolean(this.isDisabled());
      }

      return Boolean(this.isDisabled);
   }

   get container() {
      return document.querySelector(`.${Classes.Popouts} ~ .${Classes.Layers.layerContainer}`);
   }

   get canShowAbove() {
      return this.node.getBoundingClientRect().top - this.element.offsetHeight >= 0;
   }
   get canShowBelow() {
      return this.node.getBoundingClientRect().top + this.node.offsetHeight + this.element.offsetHeight <= Screen.height;
   }

   get canShowLeft() {
      return this.node.getBoundingClientRect().left - this.element.offsetWidth >= 0;
   }

   get canShowRight() {
      return this.node.getBoundingClientRect().left + this.node.offsetWidth + this.element.offsetWidth <= Screen.width;
   }

   hide() {
      if (!this.active) return;
      this.active = false;
      this.element.remove();
      this.tooltipElement.className = this._className;
   }

   show() {
      if (this.active) return;
      this.active = true;
      this.tooltipElement.className = `${Classes.Tooltip.tooltip} ${getClass(this.style)}`;
      if (this.disablePointerEvents) this.tooltipElement.classList.add(Classes.Layers.tooltipDisablePointerEvents);
      if (this.isTimestamp) this.tooltipElement.classList.add(Classes.Timestamp.timestampTooltip);
      this.labelElement.textContent = this.label;
      this.container.append(this.element);

      if (this.side == 'top') {
         if (this.canShowAbove || (!this.canShowAbove && this.preventFlip)) this.showAbove();
         else this.showBelow();
      }

      if (this.side == 'bottom') {
         if (this.canShowBelow || (!this.canShowBelow && this.preventFlip)) this.showBelow();
         else this.showAbove();
      }

      if (this.side == 'left') {
         if (this.canShowLeft || (!this.canShowLeft && this.preventFlip)) this.showLeft();
         else this.showRight();
      }

      if (this.side == 'right') {
         if (this.canShowRight || (!this.canShowRight && this.preventFlip)) this.showRight();
         else this.showLeft();
      }

      if (this.observer) return;
      this.observer = new MutationObserver((mutations) => {
         mutations.forEach((mutation) => {
            const nodes = Array.from(mutation.removedNodes);
            const directMatch = nodes.indexOf(this.node) > -1;
            const parentMatch = nodes.some(parent => parent.contains(this.node));
            if (directMatch || parentMatch) {
               this.hide();
               this.observer.disconnect();
            }
         });
      });

      this.observer.observe(document.body, { subtree: true, childList: true });
   }

   showAbove() {
      this.tooltipElement.classList.add(getClass("top"));
      this.element.style.setProperty("top", toPx(this.node.getBoundingClientRect().top - this.element.offsetHeight - 10));
      this.centerHorizontally();
   }

   showBelow() {
      this.tooltipElement.classList.add(getClass("bottom"));
      this.element.style.setProperty("top", toPx(this.node.getBoundingClientRect().top + this.node.offsetHeight + 10));
      this.centerHorizontally();
   }

   showLeft() {
      this.tooltipElement.classList.add(getClass("left"));
      this.element.style.setProperty("left", toPx(this.node.getBoundingClientRect().left - this.element.offsetWidth - 10));
      this.centerVertically();
   }

   showRight() {
      this.tooltipElement.classList.add(getClass("right"));
      this.element.style.setProperty("left", toPx(this.node.getBoundingClientRect().left + this.node.offsetWidth + 10));
      this.centerVertically();
   }

   centerHorizontally() {
      const nodecenter = this.node.getBoundingClientRect().left + (this.node.offsetWidth / 2);
      this.element.style.setProperty("left", toPx(nodecenter - (this.element.offsetWidth / 2)));
   }

   centerVertically() {
      const nodecenter = this.node.getBoundingClientRect().top + (this.node.offsetHeight / 2);
      this.element.style.setProperty("top", toPx(nodecenter - (this.element.offsetHeight / 2)));
   }

   createElement(html, fragment = false) {
      const template = document.createElement('template');
      template.innerHTML = html;
      const node = template.content.cloneNode(true);
      if (fragment) return node;
      return node.childNodes.length > 1 ? node.childNodes : node.childNodes[0];
   }
};