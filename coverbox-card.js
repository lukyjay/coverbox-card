((LitElement) => {

console.info('COVERBOX_CARD 5.0');
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

class CoverBox extends LitElement {

constructor() {
	super();
	this.bounce = null;
	this.rolling = null;
	this.pending = false;
	this.state = 0;
	this._rolled = false;
	this.old = { state: NaN, t: {} };
	this._onWindowRelease = () => this.stopRolling();
}

render() {
	if (!this.config) { return html``; }
	if (!this.config.entity) {
		return html`<ha-card>Please select a cover entity.</ha-card>`;
	}
	if (!this.stateObj) {
		return html`<ha-card>Missing entity: ${this.config.entity}</ha-card>`;
	}

	const attrMap = { name: 'friendly_name', icon: 'icon', picture: 'entity_picture' };
	for (const n of Object.keys(attrMap)) {
		if (this.config[n] === undefined && this.stateObj.attributes[attrMap[n]]) {
			this.config[n] = this.stateObj.attributes[attrMap[n]];
		}
	}

	// min / max / step can optionally be driven live from another entity
	// (e.g. an input_number that caps how far a cover is allowed to open).
	// Useful for AC static zones (i.e. must be open by x% to prevent damage)
	const numericDefaults = { min: 0, max: 100, step: 1 };
	for (const j of Object.keys(numericDefaults)) {
		const entityKey = j + '_entity';
		if (entityKey in this.config && this.config[entityKey] in this._hass.states) {
			const c = this._hass.states[this.config[entityKey]];
			this.old.t[this.config[entityKey]] = c.last_updated;
			if (!isNaN(parseFloat(c.state))) { this.config[j] = c.state; }
		}
		if (this.config[j] === undefined) { this.config[j] = numericDefaults[j]; }
		if (isNaN(parseFloat(this.config[j]))) { this.config[j] = numericDefaults[j]; }
	}

	if ('toggle_entity' in this.config && this.config.toggle_entity in this._hass.states) {
		const c = this._hass.states[this.config.toggle_entity];
		this.old.t[this.config.toggle_entity] = c.last_updated;
		this.config.toggle = c;
	}

	return html`
	<ha-card class="${(!this.config.border) ? 'noborder' : ''}">
		${(this.config.icon || this.config.picture || this.config.name) ? html`<div class="${this.config.toggle ? 'gridt' : 'grid'}">
		<div class="grid-content grid-left" @click="${() => this.moreInfo()}">
			${this.config.picture ? html`
				<state-badge
				.overrideImage="${this.config.picture}"
				></state-badge>` : this.config.icon ? html`
				<state-badge
				.overrideIcon="${this.config.icon}"
				.stateObj=${this.stateObj}
				></state-badge>` : null }
			<div class="info">
				${this.config.name ? this.config.name : ''}
				${this.secondaryInfo()}
			</div>
		</div><div class="grid-content grid-right">${this.renderNum()}</div>
		${this.config.toggle ? html`<div class="grid-content grid-right"><ha-entity-toggle .stateObj="${this.config.toggle}"
		.hass="${this._hass}"></ha-entity-toggle></div>` : null }
		</div>` : this.renderNum() }
	</ha-card>
`;
}

updated() {
	this.old.state = this.state;
}

secondaryInfo(){
	let s=this.config.secondary_info;
	if(!s){return;}
	const lu='last_updated last_changed last-updated last-changed'.split(' ');
	let ret=s;
	if(lu.indexOf(s)>-1){
		s='%'+this.config.entity+':'+(s.replace('-','_'));
	}
	let r=[];
	if(s.indexOf('%')> -1){
		ret='';
		const j=s.split(' ');
		while(j.length){
			let t=j.shift();
			if(t[0]=='%'){
				let f=NaN;
				t=t.substring(1).split(':');
				let b=this._hass.states;
				for (let d=0; d<t.length; d++){
					if(lu.indexOf(t[d])>1){t[d]=t[d].replace('-','_');}
					const id = t[d];
					if(id[0]=='~'){
						f=Number(id.substring(1));
						if(!isNaN(f)){
							let g=parseFloat(b);
							if(isNaN(g)){f=NaN;}else{b=g;}
						}
						break;
					}
					if(b.hasOwnProperty(id)){
						b=b[id];
						if(!d){
							this.old.t[id]=b.last_updated;
						}
						if(lu.indexOf(id)> -1){
							if(ret){
								const div = document.createElement('div');
								div.innerHTML=ret+' ';
								r.push(html`${div}`);
								ret = '';
							}
							r.push(html`<ha-relative-time .datetime=${new Date(b)} .hass=${this._hass} ></ha-relative-time> `);
							b='';
							break;
						}
					}
				}
				ret += (typeof b !== 'object')? (isNaN(f)?b:b.toFixed(f)) : '?';
			}else{
				ret += t;
			}
			ret += ' ';
		}
	}
	ret=ret.trim();
	if(ret){
		const d2=document.createElement('div');
		d2.innerHTML=ret;
		r.push(html`${d2}`);
	}
	return html`<div class="secondary">${r}</div>`;
}

renderNum(){
	return html`
	<section class="body">
	<div class="main">
		<div class="cur-box">
		<ha-icon class="padl" tabindex="0" role="button"
			icon="${this.config.icon_plus}"
			@click="${() => this.handleClick(1)}"
			@mousedown="${() => this.startRolling(1)}"
			@keydown="${(k) => this.handleKey(1, k)}"
			@touchstart="${() => this.startRolling(1)}"
			@mouseup="${() => this.stopRolling()}"
			@touchend="${() => this.stopRolling()}"
		>
		</ha-icon>
		<div class="cur-num-box" @click="${() => this.moreInfo()}" >
			<h3 class="cur-num ${(this.pending===false)? '':'upd'}"> ${this.niceNum()} </h3>
		</div>
		<ha-icon class="padr" tabindex="0" role="button"
			icon="${this.config.icon_minus}"
			@click="${() => this.handleClick(0)}"
			@mousedown="${() => this.startRolling(0)}"
			@keydown="${(k) => this.handleKey(0, k)}"
			@touchstart="${() => this.startRolling(0)}"
			@mouseup="${() => this.stopRolling()}"
			@touchend="${() => this.stopRolling()}"
		>
		</ha-icon>
		</div>
	</div>
	</section>`;
}

startRolling(dir) {
	if (!(this.config.speed > 0)) { return; }
	this.stopRolling();
	this._rolled = false;
	window.addEventListener('mouseup', this._onWindowRelease);
	window.addEventListener('touchend', this._onWindowRelease);
	this.rolling = setInterval(() => {
		this._rolled = true;
		this.setNumb(dir);
	}, this.config.speed);
}

stopRolling() {
	if (this.rolling) {
		clearInterval(this.rolling);
		this.rolling = null;
	}
	window.removeEventListener('mouseup', this._onWindowRelease);
	window.removeEventListener('touchend', this._onWindowRelease);
}

handleClick(dir) {
	// Suppress the click that fires right after a long-press/repeat
	// session ends, so we don't apply one extra step on top of it.
	if (this._rolled) {
		this._rolled = false;
		return;
	}
	this.setNumb(dir);
}

handleKey(dir, k) {
	if (k && (k.keyCode === 13 || k.keyCode === 32)) {
		this.setNumb(dir);
	}
}

setNumb(dir){
	let v = this.pending;
	if (v === false) {
		v = Number(this.state);
		if (isNaN(v)) { v = Number(this.config.min); }
	}
	let adval = dir ? (v + Number(this.config.step)) : (v - Number(this.config.step));
	adval = Math.round(adval * 1e9) / 1e9;

	if (adval === this.state) {
		clearTimeout(this.bounce);
		this.bounce = null;
		this.pending = false;
		return;
	}

	if (adval <= Number(this.config.max) && adval >= Number(this.config.min)) {
		this.pending = adval;
		if (this.config.delay) {
			clearTimeout(this.bounce);
			this.bounce = setTimeout(() => this.publishNum(), this.config.delay);
		} else {
			this.publishNum();
		}
	}
}

publishNum(){
	if (this.pending === false) { return; }
	const s = this.config.service.split('.');
	const v = { ...this.config.service_params, [this.config.param]: this.pending };
	this.pending = false;
	this._hass.callService(s[0], s[1], v);
}

niceNum(){
	let v = this.pending;
	if (v === false) {
		if (this.stateObj.state === 'unavailable' || this.state === null || this.state === undefined) {
			return '?';
		}
		v = Number(this.state);
		if (isNaN(v)) {
			if (this.config.initial !== undefined) {
				v = Number(this.config.initial);
				if (isNaN(v)) { return this.config.initial; }
			} else {
				return '?';
			}
		}
	}

	let fix = 0;
	const stp = Number(this.config.step) || 1;
	if (Math.round(stp) !== stp) {
		fix = (stp.toString().split('.')[1] || '').length || 1;
	}
	const fixedVal = v.toFixed(fix);
	if (isNaN(Number(fixedVal))) { return '?'; }

	const lang = {
		language: this._hass.language,
		comma_decimal: ['en-US', 'en'],
		decimal_comma: ['de', 'es', 'it'],
		space_comma: ['fr', 'sv', 'cs'],
		system: undefined,
	};
	let out = fixedVal;
	let g = (this._hass.locale && this._hass.locale.number_format) || 'language';
	if (g !== 'none') {
		g = lang.hasOwnProperty(g) ? lang[g] : lang.language;
		out = new Intl.NumberFormat(g, { maximumFractionDigits: fix, minimumFractionDigits: fix }).format(Number(fixedVal));
	}

	// Cover positions are percentages by default; allow override or hiding via `unit: false`.
	const u = this.config.unit === undefined ? '%' : this.config.unit;
	return u === false ? out : html`${out}<span class="cur-unit">${u}</span>`;
}

moreInfo() {
	const i = this.config.moreinfo;
	if(!i){return;}
	let v = 'hass-more-info'; let d = {entityId: this.config.moreinfo};
	if(i[0] == '/'){
		v = 'location-changed'; d = {replace:false};
		history.pushState(null, "", i);
	}
	const e = new Event(v, {bubbles: true, cancelable: true, composed: true});
	e.detail = d;
	this.dispatchEvent(e);
	return e;
}

static get properties() {
	return {
		_hass: {},
		config: {},
		stateObj: {},
		pending: {},
	};
}

static get styles() {
	return css`
	ha-card{
		-webkit-font-smoothing:var(--paper-font-body1_-_-webkit-font-smoothing);
		font-size:var(--paper-font-body1_-_font-size);
		font-weight:var(--paper-font-body1_-_font-weight);
		line-height:var(--paper-font-body1_-_line-height);
		padding:4px 0}
	state-badge{flex:0 0 40px;}
	ha-card.noborder{padding:0 !important;margin:0 !important;
		box-shadow:none !important;border:none !important}
	.body{
		display:grid;grid-auto-flow:column;grid-auto-columns:1fr;
		place-items:center}
	.main{display:flex;flex-direction:row;align-items:center;justify-content:center}
	.cur-box{display:flex;align-items:center;justify-content:center;flex-direction:row-reverse}
	.cur-num-box{display:flex;align-items:center}
	.cur-num{
		font-size:var(--paper-font-subhead_-_font-size);
		line-height:var(--paper-font-subhead_-_line-height);
		font-weight:normal;margin:0}
	.cur-unit{font-size:80%;opacity:0.5}
	.upd{color:#f00}
	.padr,.padl{padding:8px;cursor:pointer}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, auto);
	}
	.gridt {
		display: grid;
		grid-template-columns: repeat(3, auto);
	}
	.grid-content {
		display: grid; align-items: center;
	}
	.grid-left {
		cursor: pointer;
		flex-direction: row;
		display: flex;
		overflow: hidden;
	}
	.info{
		margin-left: 16px;
		margin-right: 8px;
		text-align: left;
		font-size: var(--paper-font-body1_-_font-size);
		flex: 1 0 30%;
	}
	.info, .info > * {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.grid-right .body{margin-left:auto}
	.grid-right {
		text-align: right
	}
	.secondary{
		color:var(--secondary-text-color);
		white-space: normal;}
	`;
}

getCardSize() {
	return 1;
}

setConfig(config) {
	if (!config.entity) { throw new Error('Please define an entity.'); }
	const domain = config.entity.split('.')[0];
	if (domain !== 'cover') {
		throw new Error('Please define a cover entity.');
	}
	this.config = {
		icon_plus: 'mdi:plus',
		icon_minus: 'mdi:minus',
		service: 'cover.set_cover_position',
		param: 'position',
		state_attribute: 'current_position',
		delay: 1000,
		speed: 0,
		refresh: 0,
		initial: undefined,
		moreinfo: config.entity,
		service_params: { entity_id: config.entity },
		...config,
	};
	if (this.config.service.split('.').length < 2) {
		this.config.service = domain + '.' + this.config.service;
	}
}

set hass(hass) {
	this._hass = hass;
	if (!hass || !this.config || !this.config.entity) { return; }

	this.stateObj = this.config.entity in hass.states ? hass.states[this.config.entity] : null;
	if (!this.stateObj) { return; }

	// Reads from `current_position` by default, but can be pointed at
	// `current_tilt_position` (together with the matching service/param)
	// to drive a tilt slider instead of the main position slider.
	const attr = this.config.state_attribute || 'current_position';
	const rawPos = this.stateObj.attributes[attr];
	if (typeof rawPos === 'number' && !isNaN(rawPos)) {
		this.state = rawPos;
	} else if (this.stateObj.state === 'open') {
		this.state = 100;
	} else {
		this.state = 0;
	}
}

shouldUpdate(changedProps) {
	const watched = this.old.t;
	for (const p in watched) {
		if (p in this._hass.states && this._hass.states[p].last_updated !== watched[p]) {
			return true;
		}
	}
	if (changedProps.has('pending')) {
		// Always redraw immediately when the user presses +/- so the
		// pending value shows right away, before HA confirms the change.
		return true;
	}
	if (changedProps.has('config') || changedProps.has('stateObj')) {
		return this.old.state !== this.state || !!this.config.refresh;
	}
	return false;
}

disconnectedCallback() {
	super.disconnectedCallback();
	this.stopRolling();
	if (this.bounce) {
		clearTimeout(this.bounce);
		this.bounce = null;
	}
}

static getConfigElement() {
	return document.createElement("coverbox-card-editor");
}

static getStubConfig(hass, entities) {
	const coverEntity = (entities || []).find((e) => e.startsWith('cover.'));
	return { entity: coverEntity || '', border: true };
}

} customElements.define('coverbox-card', CoverBox);

//Editor
const fireEvent = (node, type, detail = {}, options = {}) => {
	const event = new Event(type, {
		bubbles: options.bubbles === undefined ? true : options.bubbles,
		cancelable: Boolean(options.cancelable),
		composed: options.composed === undefined ? true : options.composed,
	});
	event.detail = detail;
	node.dispatchEvent(event);
	return event;
};

class CoverBoxEditor extends LitElement {

async Pick(){
	const c="ha-entity-picker";
	if(!customElements.get(c)){
		try {
			const r = "partial-panel-resolver";
			await customElements.whenDefined(r);
			const p = document.createElement(r);
			p.hass = {panels: [{url_path: "tmp", component_name: "config"}]};
			p._updateRoutes();
			await p.routerOptions.routes.tmp.load();
			const d=document.createElement("ha-panel-config");
			await d.routerOptions.routes.automation.load();
		} catch (e) {
			console.warn('coverbox-card: could not preload ha-entity-picker', e);
		}
	}
	this.render();
}
static get properties() {
	return { hass: {}, config: {} };
}

static get styles() {
	return css`
.side {
	display:flex;
	align-items:center;
}
.side > * {
	flex:1;
	padding-right:4px;
}	
`;
}
get _border() {
	if (this.config.border) {
		return true;
	} else {
		return false;
	}
}
setConfig(config) {
	this.config = config;
	this.Pick();
}

render() {
	if (!this.hass){ return html``; }
	return html`
<div class="side">
	<ha-entity-picker
		label="Entity (required)"
		.hass=${this.hass}
		.value="${this.config.entity}"
		.configValue=${'entity'}
		.includeDomains=${['cover']}
		@change="${this.updVal}"
		allow-custom-entity
	></ha-entity-picker>
	<ha-formfield label="Show border?">
		<ha-switch
			.checked=${this._border}
			.configValue="${'border'}"
			@change=${this.updVal}
		></ha-switch>
	</ha-formfield>
</div>
<div class="side">
	<ha-textfield
		label="Name (Optional, false to hide)"
		.value="${(this.config.name!==undefined)?this.config.name:''}"
		.configValue="${'name'}"
		@input="${this.updVal}"
	></ha-textfield>
	<ha-icon-picker
		label="Icon (Optional, false to hide)"
		.value="${(this.config.icon!==undefined)?this.config.icon:''}"
		.configValue="${'icon'}"
		@value-changed="${this.updVal}"
	></ha-icon-picker>
</div>
<div class="side">
	<ha-textfield
		label="Secondary Info (Optional)"
		.value="${(this.config.secondary_info!==undefined)?this.config.secondary_info:''}"
		.configValue="${'secondary_info'}"
		@input="${this.updVal}"
	></ha-textfield>
</div>
<div class="side">
	<ha-textfield
		label="Picture url(Optional, false to hide)"
		.value="${(this.config.picture!==undefined)?this.config.picture:''}"
		.configValue="${'picture'}"
		@input="${this.updVal}"
	></ha-textfield>
</div><div class="side">
	<ha-icon-picker
		label="Icon Plus"
		.value="${(this.config.icon_plus)?this.config.icon_plus:'mdi:plus'}"
		.configValue=${'icon_plus'}
		@value-changed=${this.updVal}
	></ha-icon-picker>
	<ha-icon-picker
		label="Icon Minus"
		.value="${(this.config.icon_minus)?this.config.icon_minus:'mdi:minus'}"
		.configValue=${'icon_minus'}
		@value-changed=${this.updVal}
	></ha-icon-picker>
</div>			
<div class="side">
	<ha-textfield
		label="Initial [?]"
		.value="${(this.config.initial!==undefined)?this.config.initial:'?'}"
		.configValue=${'initial'}
		@input=${this.updVal}
		type="number"
		step="any"
	></ha-textfield>
	<ha-textfield
		label="Unit (default %, false to hide)"
		.value="${(this.config.unit!==undefined)?this.config.unit:''}"
		.configValue=${'unit'}
		@input=${this.updVal}
	></ha-textfield>
</div>
<div class="side">
	<ha-textfield
		label="Update Delay (ms)"
		.value="${(this.config.delay!==undefined)?this.config.delay:'1000'}"
		.configValue=${'delay'}
		@input=${this.updVal}
		type="number"
	></ha-textfield>
	<ha-textfield
		label="Long press Speed (ms)"
		.value="${(this.config.speed!==undefined)?this.config.speed:'0'}"
		.configValue=${'speed'}
		@input=${this.updVal}
		type="number"
	></ha-textfield>
</div>
<div><b>Advanced Config</b></div>
<div class="side">
	<ha-textfield
		label="min"
		.value="${(this.config.min!==undefined)?this.config.min:''}"
		.configValue="${'min'}"
		@input="${this.updVal}"
		type="number"
		step="any"
	></ha-textfield>
	<ha-textfield
		label="max"
		.value="${(this.config.max!==undefined)?this.config.max:''}"
		.configValue="${'max'}"
		@input="${this.updVal}"
		type="number"
		step="any"
	></ha-textfield>
	<ha-textfield
		label="step"
		.value="${(this.config.step!==undefined)?this.config.step:''}"
		.configValue="${'step'}"
		@input="${this.updVal}"
		type="number"
		step="any"
	></ha-textfield>
</div>
<div class="side">
	<ha-entity-picker
		label="min_entity"
		.hass=${this.hass}
		.value="${this.config.min_entity}"
		.configValue=${'min_entity'}
		@change="${this.updVal}"
		allow-custom-entity
	></ha-entity-picker>
	<ha-entity-picker
		label="max_entity"
		.hass=${this.hass}
		.value="${this.config.max_entity}"
		.configValue=${'max_entity'}
		@change="${this.updVal}"
		allow-custom-entity
	></ha-entity-picker>
</div>
<div class="side">
	<ha-entity-picker
		label="step_entity"
		.hass=${this.hass}
		.value="${this.config.step_entity}"
		.configValue=${'step_entity'}
		@change="${this.updVal}"
		allow-custom-entity
	></ha-entity-picker>
	<ha-entity-picker
		label="toggle_entity"
		.hass=${this.hass}
		.value="${this.config.toggle_entity}"
		.configValue=${'toggle_entity'}
		@change="${this.updVal}"
		allow-custom-entity
	></ha-entity-picker>
</div>
<div class="side">
	<ha-entity-picker
		label="moreinfo"
		.hass=${this.hass}
		.value="${this.config.moreinfo}"
		.configValue=${'moreinfo'}
		@change="${this.updVal}"
		allow-custom-entity
	></ha-entity-picker>
</div>
<div class="side">
	<ha-textfield
		label="service"
		.value="${(this.config.service!==undefined)?this.config.service:''}"
		.configValue="${'service'}"
		@input="${this.updVal}"
	></ha-textfield>
	<ha-textfield
		label="param"
		.value="${(this.config.param!==undefined)?this.config.param:''}"
		.configValue="${'param'}"
		@input="${this.updVal}"
	></ha-textfield>
	<ha-textfield
		label="state_attribute (e.g. current_tilt_position)"
		.value="${(this.config.state_attribute!==undefined)?this.config.state_attribute:'current_position'}"
		.configValue="${'state_attribute'}"
		@input="${this.updVal}"
	></ha-textfield>
</div>

`;
}


updVal(v) {
	if (!this.config || !this.hass) {return;}
	const { target } = v;
	if (this[`_${target.configValue}`] === target.value) {
		return;
	}
	if (target.configValue) {
		if (target.value === '') {
			try{delete this.config[target.configValue];}catch(e){}
		} else {
			const reg = new RegExp(/^-?\d*\.?\d+$/);
			if (target.value === 'false') {
				target.value = false;
			}else if(reg.test(target.value)){
				target.value=Number(target.value);
			}
			this.config = {
				...this.config,
				[target.configValue]: target.checked !== undefined ? target.checked : target.value,
			};
		}
	}
	fireEvent(this, 'config-changed', { config: this.config });
}

}
customElements.define("coverbox-card-editor", CoverBoxEditor);

})(window.LitElement || Object.getPrototypeOf(customElements.get("hui-masonry-view") ));

window.customCards = window.customCards || [];
window.customCards.push({
	type: 'coverbox-card',
	name: 'Coverbox Card',
	preview: false,
	description: 'Replace cover position sliders with plus and minus buttons'
});
