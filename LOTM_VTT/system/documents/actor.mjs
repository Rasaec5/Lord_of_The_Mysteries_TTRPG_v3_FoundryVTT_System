  export default class LOTM_VTTActor extends Actor {
      /** @override */
      prepareDerivedData() {
          switch ( this.type ) {
              case "pc": return this._preparePCDerivedData();
          }
      }

      /* -------------------------------------------- */


      /* -------------------------------------------- */

      async _preparePCDerivedData() {
          const editMode = this.flags["LOTM_VTT"]?.["edit-mode"] ?? true;


          

          // MyLoot Document Array Derived Data
          this.system.myloot = this.items.filter((item) => item.type == "loot");

          // Reapply Active Effects for calculated values

          // Bridge fighter.system.* active effect overrides into system.* for flat (non-nested) fields.
          // allApplicableEffects cannot strip the type prefix in V14 (changes is getter-only),
          // so Foundry applies flat fields (e.g. bonusdamage, resistanceflat) to actor.fighter.system.*
          // Nested fields (e.g. fight.value) are handled by reapplyActiveEffectsForName above.
          const _typeOverrides = this.overrides?.pc?.system ?? {};
          for (const [_k, _v] of Object.entries(_typeOverrides)) {
              if (typeof _v !== 'object' && _k in this.system) {
                  this.system[_k] = _v;
              }
          }
      }

  
      /* -------------------------------------------- */

              async _preUpdate(data, options, userId) {
                  await super._preUpdate(data, options, userId);
                  if (!options.diff || data === undefined) return;
                  let changes = {};

                  // Foundry v12 no longer has diffed data during _preUpdate, so we need to compute it ourselves.
                  if (game.release.version >= 12) {
                      // Retrieve a copy of the existing actor data.
                      let newData = game.system.utils.flattenObject(data);
                      let oldData = game.system.utils.flattenObject(this);

                      // Limit data to just the new data.
                      const diffData = foundry.utils.diffObject(oldData, newData);
                      changes = foundry.utils.expandObject(diffData);
                  }
                  else {
                      changes = foundry.utils.duplicate(data);
                  }

                  // Handle name changes
                  if (changes.name) {
                      let tokenData = {};

                      // Propagate name update to prototype token if same as actor
                      if (changes.name && this.name == this.prototypeToken.name) {
                          data.prototypeToken = {name: data.name};
                      }

                      // Update tokens.
                      let tokens = this.getActiveTokens();
                      tokens.forEach(token => {
                          let updateData = foundry.utils.duplicate(tokenData);

                          // Propagate name update to token if same as actor
                          if (data.name && this.name == token.name) {
                              updateData.name = data.name;
                          }
                          token.document.update(updateData);
                      });
                  }

                  if (changes.system === undefined) return; // Nothing more to do

                  const deltas = {};

                  if (this.type == "pc") this._handlePreUpdatePCDelta(changes, deltas);

                  options.fromPreUpdate = deltas;
              }

              /* -------------------------------------------- */

              _handlePreUpdatePCDelta(changes, deltas) {
                  // Health resource updates
                  if (changes.system.hp === undefined) return;

                  // Store value and temp changes
                  const valueChange = changes.system.hp.value;
                  const tempChange = changes.system.hp.temp;

                  // Calculate delta
                  if (valueChange !== undefined) {
                      const delta = valueChange - this.system.hp.value;
                      if (delta !== 0) {
                          deltas.hp = delta;
                      }
                  }

                  // Calculate temp delta
                  if (tempChange !== undefined) {
                      const tempDelta = tempChange - this.system.hp.temp;
                      if (tempDelta !== 0) {
                          deltas.hpTemp = tempDelta;
                      }
                  }
              }


              /* -------------------------------------------- */

              async _onUpdate(data, options, userId) {
                  await super._onUpdate(data, options, userId);

                  // Iterate over all objects in fromPreUpdate, showing scrolling text for each.
                  if (options.fromPreUpdate) {
                      for (const [key, delta] of Object.entries(options.fromPreUpdate)) {
                          this._showScrollingText(delta, key);
                      }
                  }

                  // Add / remove status effects
                  const calculatedStatusEffects = CONFIG.statusEffects.filter(effect => effect.calculated);
                  for (const effect of calculatedStatusEffects) {
                      const key = effect.id;
                      const active = this.system[key] ?? false;
                      const existing = this.effects.find(e => e.statuses.has(key));

                      if ((active && existing) || (!active && !existing)) continue;

                      // If the effect is active the AE doesn't exist, add it
                      if (active && !existing) {
                          const cls = getDocumentClass("ActiveEffect");
                          const createData = foundry.utils.deepClone(effect);
                          createData.statuses = [key];
                          delete createData.id;
                          createData.name = game.i18n.localize(createData.name);
                          await cls.create(createData, {parent: this});
                          if (key == "dead") Hooks.callAll("death", this);
                      }

                      // If the effect is active the AE doesn't exist, add it
                      if (!active && existing) {
                          this.deleteEmbeddedDocuments("ActiveEffect", [existing.id]);
                      }
                  }
              }

              /* -------------------------------------------- */

              async _onCreate(data, options, userId) {
                  await super._onCreate(data, options, userId);

                  console.log("onCreate", data, options, userId);

                  switch ( data.type ) {
                      case "pc": {
                          // HP health resource

                          if ( !data.prototypeToken.bar1.attribute ) data.prototypeToken.bar1.attribute = "hp";
                          if ( !data.prototypeToken.displayBars ) data.prototypeToken.displayBars = CONST.TOKEN_DISPLAY_MODES.ALWAYS;
                      }
                  }
              }

              /* -------------------------------------------- */

              _showScrollingText(delta, suffix="", overrideOptions={}) {
              // Show scrolling text of hp update
              const tokens = this.isToken ? [this.token?.object] : this.getActiveTokens(true);
              if (delta != 0 && tokens.length > 0) {
                  let color = delta < 0 ? 0xcc0000 : 0x00cc00;
                  for ( let token of tokens ) {
                      let textOptions = {
                          anchor: CONST.TEXT_ANCHOR_POINTS.CENTER,
                          direction: CONST.TEXT_ANCHOR_POINTS.TOP,
                          fontSize: 32,
                          fill: color,
                          stroke: 0x000000,
                          strokeThickness: 4,
                          duration: 3000
                      };
                      canvas.interface.createScrollingText(
                          token.center,
                          delta.signedString()+" "+suffix,
                          foundry.utils.mergeObject(textOptions, overrideOptions)
                      );
                      // Flash dynamic token rings.
                      if (token?.ring) {
                          const flashColor = delta < 0 ? Color.fromString('#ff0000') : Color.fromString('#00ff00');
                          token.ring.flashColor(flashColor, {
                              duration: 600,
                              easing: foundry.canvas.tokens.TokenRing.easeTwoPeaks,
                          });
                      }
                  }
              }
          }

      /* -------------------------------------------- */

      reapplyActiveEffectsForName(name) {
          if (this.documentName !== "Actor") return;
          for (const effect of this.appliedEffects) {
              for (const change of effect.changes) {
                  if (change.key == name) {
                      const changes = effect.apply(this, change);
                      Object.assign(this.overrides, changes);
                  }
              }
          }
      }

      /* -------------------------------------------- */

      /** @override */
      _initialize(options = {}) {
          super._initialize(options);
          
          switch ( this.type ) {
              case "pc": return this._registerPCHooks(this);
          }
      }

      /* -------------------------------------------- */

      _registerPCHooks(document) {
      }


      /* -------------------------------------------- */

      // In order to support per-document type effects, we need to override the allApplicableEffects method to yield virtualized effects with only changes that match the document type
      /** @override */
      *allApplicableEffects() {
          const systemFlags = this.flags["LOTM_VTT"] ?? {};
          const edit = systemFlags["edit-mode"] ?? true;

          function getTypedEffect(type, edit, effect, source) {
              // Pre-build data to avoid mutating ActiveEffect getters (changes is getter-only in v14).
              const data = foundry.utils.duplicate(effect);
              data.changes = (data.changes ?? []).filter(c => c.key.startsWith(type));
              for ( const change of data.changes ) {
                  if (change.mode == 0) continue;
                  change.key = change.key.replace(type + ".", "");
              }
              if ( edit ) data.disabled = true;
              data.flags ??= {};
              data.flags["LOTM_VTT"] ??= {};
              data.flags["LOTM_VTT"].source = source;
              return new ActiveEffect(data, {parent: effect.parent});
          }

          for ( const effect of this.effects ) {
              yield getTypedEffect(this.type, edit, effect, game.i18n.localize("Self"));
          }
          for ( const item of this.items ) {
              for ( const effect of item.effects ) {
                  if ( effect.transfer ) yield getTypedEffect(this.type, edit, effect, item.name);
              }
          }

      }


      /* -------------------------------------------- */

      _onCreateDescendantDocuments(parent, collection, documents, data, options, userId) {
          super._onCreateDescendantDocuments(parent, collection, documents, data, options, userId);

          for (const document of documents) {
              if (document.documentName !== "ActiveEffect") continue;
              
              for (const change of document.changes) {
                  if (change.mode != 0) continue;
                  const customMode = foundry.utils.getProperty(document.flags["LOTM_VTT"], change.key + "-custommode");
                  switch (customMode) {
                      case 1: // Add Once
                          this._effectAddOnce(parent, document, change);
                          break;
                      default:
                          console.error("Unknown custom mode", customMode);
                          break;
                  }
              }
          }
      }

      /* -------------------------------------------- */

      _effectAddOnce(parent, ae, change) {
          console.dir("AddOnce", parent, ae, change);

          const key = change.key.replace(parent.type + ".", "");
          const currentValue = foundry.utils.getProperty(parent, key);

          // Create an update for the parent
          const update = {
              [key]: currentValue + parseInt(change.value)
          };
          parent.update(update);

          // Create a chat card
          const chatData = {
              user: game.user._id,
              speaker: ChatMessage.getSpeaker({ actor: parent }),
              content: `<p>Added "${ae.name}" once</p>`
          };
          ChatMessage.create(chatData);
      }

      /* -------------------------------------------- */
      
      static async createDialog(data = {}, { parent = null, pack = null, types = null, ...options } = {}) {
          types ??= game.documentTypes[this.documentName].filter(t => (t !== CONST.BASE_DOCUMENT_TYPE) && (CONFIG[this.documentName].typeCreatables[t] !== false));
          if (!types.length) return null;

          const collection = parent ? null : pack ? game.packs.get(pack) : game.collections.get(this.documentName);
          const folders = collection?._formatFolderSelectOptions() ?? [];

          const label = game.i18n.localize(this.metadata.label);
          const title = game.i18n.format("DOCUMENT.Create", { type: label });
          const name = data.name || game.i18n.format("DOCUMENT.New", { type: label });

          let type = data.type || CONFIG[this.documentName]?.defaultType;
          if (!types.includes(type)) type = types[0];

          // If there's only one type, no need to prompt
          if (types.length === 1) {
              let createName = this.defaultName();
              const createData = {
                  name: createName,
                  type
              };
              return this.create(createData, { parent, pack, renderSheet: true });
          }
          
          const createResponse = await game.system.documentCreateDialog.prompt({
              type,
              types: types.reduce((arr, typer) => {
                  arr.push({
                      type: typer,
                      label: game.i18n.has(typer) ? game.i18n.localize(typer) : typer,
                      icon: this.getDefaultArtwork({ type: typer })?.img ?? "icons/svg/item-bag.svg",
                      description: CONFIG[this.documentName]?.typeDescriptions?.[typer] ?? "",
                      selected: type === typer
                  });
                  return arr;
              }, []).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang)),
              name,
              title,
              label,
              folders,
              folder: data.folder
          });
          
          const createData = foundry.utils.mergeObject(data, createResponse, { inplace: false });
          createData.type = createData.type || type;
          // The type field can come back as the autocomplete's display label (e.g. the
          // localized "Basic Hero") rather than the machine type ("basichero"). Lower-casing
          // alone doesn't recover a multi-word machine type, so map the response back against
          // the known types -- matching either the raw machine type or its displayed label --
          // and fall back to the resolved default type if nothing matches.
          if (!types.includes(createData.type)) {
              createData.type = types.find(t => t === createData.type || (game.i18n.has(t) ? game.i18n.localize(t) : t) === createData.type) ?? type;
          }
          if (!createData.folder) delete createData.folder;
          if (!createData.name?.trim()) createData.name = this.defaultName();
          return this.create(createData, { parent, pack, renderSheet: true });

          const content = await renderTemplate("systems/LOTM_VTT/system/templates/document-create.hbs", {
              folders, name, type,
              folder: data.folder,
              hasFolders: folders.length > 0,
              types: types.reduce((arr, typer) => {
                  arr.push({
                      type: typer,
                      label: game.i18n.has(typer) ? game.i18n.localize(typer) : typer,
                      icon: this.getDefaultArtwork({ type: typer })?.img ?? "icons/svg/item-bag.svg",
                      description: CONFIG[this.documentName]?.typeDescriptions?.[typer] ?? "",
                      selected: type === typer
                  });
                  return arr;
              }, []).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
          });
          return Dialog.prompt({
              title, content,
              label: title,
              render: html => {
                  const app = html.closest(".app");
                  const folder = app.querySelector("select");
                  if (folder) app.querySelector(".dialog-buttons").insertAdjacentElement("afterbegin", folder);
                  app.querySelectorAll(".window-header .header-button").forEach(btn => {
                      const label = btn.innerText;
                      const icon = btn.querySelector("i");
                      btn.innerHTML = icon.outerHTML;
                      btn.dataset.tooltip = label;
                      btn.setAttribute("aria-label", label);
                  });
                  app.querySelector(".document-name").select();
              },
              callback: html => {
                  const form = html.querySelector("form");
                  const fd = new FormDataExtended(form);
                  const createData = foundry.utils.mergeObject(data, fd.object, { inplace: false });

              },
              rejectClose: false,
              options: { ...options, jQuery: false, width: 700, height: 'auto', classes: ["LOTM_VTT", "create-document", "dialog"] }
          });
      }

      /* -------------------------------------------- */

      static getDefaultArtwork(itemData = {}) {
          const { type } = itemData;
          const { img, texture } = super.getDefaultArtwork(itemData);
          return { img: CONFIG[this.documentName]?.typeArtworks?.[type] ?? img, texture: texture };
      }

      /* -------------------------------------------- */

      getRollData() {
          const data = super.getRollData();
          const rollData = foundry.utils.duplicate(data);
          rollData.system = this.system;
          return rollData;
      }

      /* -------------------------------------------- */

      /** @override */
      async modifyTokenAttribute(attribute, value, isDelta, isBar) {
          const resource = foundry.utils.getProperty(this.system, attribute);

          if (isDelta && value < 0) {
              // Apply to temp first
              resource.temp += value;

              // If temp is negative, apply to value
              if (resource.temp < 0) {
                  resource.value += resource.temp;
                  resource.temp = 0;
              }
              await this.update({ ["system." + attribute]: resource });
              return;
          }

          return super.modifyTokenAttribute(attribute, value, isDelta, isBar);
      }

      /* -------------------------------------------- */

      getInitiativeFormula() {
          switch ( this.type ) {
              case "pc": return "0";
          }
      }

  }
