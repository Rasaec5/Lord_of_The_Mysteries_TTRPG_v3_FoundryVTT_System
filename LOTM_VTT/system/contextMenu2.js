export class ContextMenu2 {
    constructor(element, selector, menuItems, {eventName="contextmenu"}={}) {

        /**
         * The target HTMLElement being selected
         * @type {HTMLElement}
         */
        this.element = element;
    
        /**
         * The target CSS selector which activates the menu
         * @type {String}
         */
        this.selector = selector || element.attr("id");
    
        /**
         * An interaction event name which activates the menu
         * @type {String}
         */
        this.eventName = eventName;
    
        /**
         * The array of menu items being rendered
         * @type {Array}
         */
        this.menuItems = menuItems;
    
        /**
         * Track which direction the menu is expanded in
         * @type {Boolean}
         */
        this._expandUp = false;
    
        // Bind to the current element
        this.bind();
    }

    /* -------------------------------------------- */

    /**
     * A convenience accessor to the context menu HTML object
     * @return {*|jQuery.fn.init|jQuery|HTMLElement}
     */
    get menu() {
        return $("#context-menu2");
    }

    /* -------------------------------------------- */

    /**
     * Attach a ContextMenu instance to an HTML selector
     */
    bind() {
        this.element.on(this.eventName, this.selector, event => {
            event.preventDefault();
            event.stopPropagation();
            let parent = $(event.currentTarget);

            if (this.selector == ".message") return;

            // Remove existing context UI
            $('.context').removeClass("context");

            // The menu mounts on <body> (not inside the target), so a fresh right-click can't
            // rely on DOM containment to toggle. Tear down any open menu immediately to avoid
            // duplicates/animation races, then open a fresh one anchored to this target.
            $("#context-menu2").stop(true, true).remove();
            if ( ui.context ) delete ui.context;

            this.render(parent);
            ui.context = this;
        })
    }

    /* -------------------------------------------- */

    /**
     * Animate closing the menu by sliding up and removing from the DOM
     */
    async close() {
        let menu = this.menu;
        await this._animateClose(menu);
        menu.remove();
        $('.context').removeClass("context");
        delete ui.context;
    }

    /* -------------------------------------------- */

    async _animateOpen(menu) {
        menu.hide();
        return new Promise(resolve => menu.slideDown(200, resolve));
    }

    /* -------------------------------------------- */

    async _animateClose(menu) {
        return new Promise(resolve => menu.slideUp(200, resolve));
    }

    /* -------------------------------------------- */

    /**
     * Render the Context Menu by iterating over the menuItems it contains
     * Check the visibility of each menu item, and only render ones which are allowed by the item's logical condition
     * Attach a click handler to each item which is rendered
     * @param target
     */
    render(target) {
        // Always a fresh node -- bind() removed any prior menu, so appending h2/items here
        // can't accumulate onto a reused element.
        let html = $('<nav id="context-menu2" data-mod="1"></nav>');
        let ol = $('<ol class="context-items"></ol>');
        html.append($(`<h2>${game.i18n.localize('CONTEXT.ApplyChanges')}</h2>`));
        html.append(ol);

        // Determine if user-selected targets are allowed.
        const allowTargeting = game.settings.get('LOTM_VTT', 'allowTargetDamageApplication');
        let targetType = game.settings.get('LOTM_VTT', 'userTargetDamageApplicationType');
        if (!allowTargeting && targetType !== 'selected') {
            game.settings.set('LOTM_VTT', 'userTargetDamageApplicationType', 'selected');
            targetType = 'selected';
        }

        // Add default target type.
        html[0].dataset.target = targetType;
    
        // Build menu items
        for (let item of this.menuItems) {
            
            // Determine menu item visibility (display unless false)
            let display = true;
            if ( item.condition !== undefined ) {
            display = ( item.condition instanceof Function ) ? item.condition(target) : item.condition;
            }
            if ( !display ) continue;
    
            // Construct and add the menu item
            let name = game.i18n.localize(item.name);
            let li = $(`<li class="context-item ${item?.id ?? ''}">${item.icon}${name}</li>`);
            // If this is the target buttons option, set one of them to active.
            if (name.includes('data-target="targeted"')) {
                const button = li.find(`[data-target="${targetType}"]`);
                button.addClass('active');
            }
            li.children("i").addClass("fa-fw");
            li.click(e => {
                e.preventDefault();
                e.stopPropagation();
                item.callback(target, e);
                // If this was a target button, prevent closing the context menu.
                if (!item?.preventClose) {
                    this.close();
                }
            });
            ol.append(li);
        }
    
        // Bail out if there are no children
        if ( ol.children().length === 0 ) return;
    
        // Append to target
        this._setPosition(html, target);

        // Deactivate global tooltip
        game.tooltip.deactivate();
    
        // Animate open the menu
        return this._animateOpen(html);
    }

    /* -------------------------------------------- */

    /**
     * Set the position of the context menu, taking into consideration whether the menu should expand upward or downward
     * @private
     */
    _setPosition(html, target) {
        const targetRect = target[0].getBoundingClientRect();

        // Mount on <body> with fixed positioning so the menu escapes the chat log's overflow
        // clipping (#chat-log is overflow-x:hidden / overflow-y:auto) and any transformed sheet
        // ancestor. We then place it explicitly in viewport coordinates.
        html.css("visibility", "hidden");
        document.body.appendChild(html[0]);
        const contextRect = html[0].getBoundingClientRect();

        // Expand upward only when there isn't room below the target but there is above it.
        const roomBelow = window.innerHeight - targetRect.bottom;
        this._expandUp = (roomBelow < contextRect.height) && (targetRect.top > contextRect.height);
        const top = this._expandUp
            ? targetRect.top - contextRect.height - 2
            : targetRect.bottom + 2;

        // Align to the target's left edge, clamped to stay within the viewport.
        let left = targetRect.left;
        const maxLeft = window.innerWidth - contextRect.width - 4;
        if (left > maxLeft) left = maxLeft;
        if (left < 4) left = 4;

        // Display the menu
        html.css({ top: Math.round(top) + "px", left: Math.round(left) + "px" });
        html.addClass(this._expandUp ? "expand-up" : "expand-down");
        html.css("visibility", "");
        target.addClass("context");
    }

    /* -------------------------------------------- */

    static eventListeners() {
        document.addEventListener("click", ev => {
            if ( ui.context ) ui.context.close();
        });
    };
}
