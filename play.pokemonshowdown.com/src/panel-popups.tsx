import preact from "../js/lib/preact";
import { toID, toRoomid, toUserid, Dex } from "./battle-dex";
import type { ID } from "./battle-dex-data";
import { BattleLog } from "./battle-log";
import { PSLoginServer } from "./client-connection";
import { PSBackground } from "./client-core";
import { PSRoom, type RoomOptions, PS, type PSLoginState, type RoomID, type TimestampOptions } from "./client-main";
import { type BattleRoom } from "./panel-battle";
import type { ChatRoom } from "./panel-chat";
import { PSRoomPanel, PSPanelWrapper } from "./panels";
import { PSHeader } from "./panel-topbar";

/**
 * User popup
 */

export class UserRoom extends PSRoom {
	override readonly classType = 'user';
	userid!: ID;
	name!: string;
	isSelf!: boolean;
	constructor(options: RoomOptions) {
		super(options);
		const userid = (this.id.split('-')[1] || '') as ID;
		this.setName(options.args?.username as string || userid);
	}
	setName(name: string) {
		this.name = name;
		this.userid = toID(name);
		this.isSelf = (this.userid === PS.user.userid);
		if (/[a-zA-Z0-9]/.test(this.name.charAt(0))) this.name = ' ' + this.name;
		this.update(null);
		if (this.userid) PS.send(`|/cmd userdetails ${this.userid}`);
	}
}

class UserPanel extends PSRoomPanel<UserRoom> {
	static readonly id = 'user';
	static readonly routes = ['user-*', 'viewuser-*', 'users'];
	static readonly Model = UserRoom;
	static readonly location = 'popup';

	renderUser() {
		const room = this.props.room;
		if (!room.userid) return null;
		const user = PS.mainmenu.userdetailsCache[room.userid] || {
			userid: room.userid, name: room.name.slice(1), avatar: '[loading]',
		};
		if (!user.avatar) {
			// offline; server doesn't know the actual username
			user.name = room.name;
		}
		const hideInteraction = room.id.startsWith('viewuser-');

		const group = PS.server.getGroup(room.name);
		let groupName: preact.ComponentChild = group.name || null;
		if (group.type === 'punishment') {
			groupName = <span style="color:#777777">{groupName}</span>;
		}

		const globalGroup = PS.server.getGroup(user.group);
		let globalGroupName: preact.ComponentChild = globalGroup.name && `Global ${globalGroup.name}` || null;
		if (globalGroup.type === 'punishment') {
			globalGroupName = <span style="color:#777777">{globalGroupName}</span>;
		}
		if (globalGroup.name === group.name) groupName = null;

		let roomsList: preact.ComponentChild = null;
		if (user.rooms) {
			let battlebuf = [];
			let chatbuf = [];
			let privatebuf = [];
			for (let roomid in user.rooms) {
				if (roomid === 'global') continue;
				const curRoom = user.rooms[roomid];
				let roomrank: preact.ComponentChild = null;
				if (!/[A-Za-z0-9]/.test(roomid.charAt(0))) {
					roomrank = <small style="color: #888; font-size: 100%">{roomid.charAt(0)}</small>;
				}
				roomid = toRoomid(roomid);

				if (roomid.substr(0, 7) === 'battle-') {
					const p1 = curRoom.p1!.substr(1);
					const p2 = curRoom.p2!.substr(1);
					const ownBattle = (PS.user.userid === toUserid(p1) || PS.user.userid === toUserid(p2));
					const roomLink = <a
						href={`/${roomid}`} class={'ilink' + (ownBattle || roomid in PS.rooms ? ' yours' : '')}
						title={`${p1 || '?'} v. ${p2 || '?'}`}
					>{roomrank}{roomid.substr(7)}</a>;
					if (curRoom.isPrivate) {
						if (privatebuf.length) privatebuf.push(', ');
						privatebuf.push(roomLink);
					} else {
						if (battlebuf.length) battlebuf.push(', ');
						battlebuf.push(roomLink);
					}
				} else {
					const roomLink = <a href={`/${roomid}`} class={'ilink' + (roomid in PS.rooms ? ' yours' : '')}>
						{roomrank}{roomid}
					</a>;
					if (curRoom.isPrivate) {
						if (privatebuf.length) privatebuf.push(", ");
						privatebuf.push(roomLink);
					} else {
						if (chatbuf.length) chatbuf.push(', ');
						chatbuf.push(roomLink);
					}
				}
			}
			if (battlebuf.length) battlebuf.unshift(<br />, <em>Battles:</em>, " ");
			if (chatbuf.length) chatbuf.unshift(<br />, <em>Chatrooms:</em>, " ");
			if (privatebuf.length) privatebuf.unshift(<br />, <em>Private rooms:</em>, " ");
			if (battlebuf.length || chatbuf.length || privatebuf.length) {
				roomsList = <small class="rooms">{battlebuf}{chatbuf}{privatebuf}</small>;
			}
		} else if (user.rooms === false) {
			roomsList = <strong class="offline">OFFLINE</strong>;
		}

		const isSelf = user.userid === PS.user.userid;
		let away = false;
		let status = null;
		if (user.status) {
			away = user.status.startsWith('!');
			status = away ? user.status.slice(1) : user.status;
		}

		const buttonbar = [];
		if (!hideInteraction) {
			buttonbar.push(isSelf ? (
				<p class="buttonbar">
					<button class="button" disabled>Challenge</button> {}
					<button class="button" data-href="dm-">Chat Self</button>
				</p>
			) : !PS.user.named ? (
				<p class="buttonbar">
					<button class="button" disabled>Challenge</button> {}
					<button class="button" disabled>Chat</button> {}
					<button class="button" disabled>{'\u2026'}</button>
				</p>
			) : (
				<p class="buttonbar">
					<button class="button" data-href={`challenge-${user.userid}`}>Challenge</button> {}
					<button class="button" data-href={`dm-${user.userid}`}>Chat</button> {}
					<button class="button" data-href={`useroptions-${user.userid}-${room.parentRoomid || ''}`}>{'\u2026'}</button>
				</p>
			));
			if (isSelf) {
				buttonbar.push(
					<hr />,
					<p class="buttonbar" style="text-align: right">
						<button class="button" data-href="login"><i class="fa fa-pencil"></i> Change name</button> {}
						<button class="button" data-cmd="/logout"><i class="fa fa-power-off"></i> Log out</button>
					</p>
				);
			}
		}

		const avatar = user.avatar !== '[loading]' ? Dex.resolveAvatar(`${user.avatar || 'unknown'}`) : null;
		return [<div class="userdetails">
			{avatar && (room.isSelf ? (
				<img src={avatar} class="trainersprite yours" data-href="avatars" />
			) : (
				<img src={avatar} class="trainersprite" />
			))}
			<strong><a
				href={`//${Config.routes.users}/${user.userid}`} target="_blank"
				style={{ color: away ? '#888888' : BattleLog.usernameColor(user.userid) }}
			>
				{user.name}
			</a></strong><br />
			{status && <div class="userstatus">{status}</div>}
			{groupName && <div class="usergroup roomgroup">{groupName}</div>}
			{globalGroupName && <div class="usergroup globalgroup">{globalGroupName}</div>}
			{user.customgroup && <div class="usergroup globalgroup">{user.customgroup}</div>}
			{!hideInteraction && roomsList}
		</div>, buttonbar];
	}

	lookup = (ev: Event) => {
		ev.preventDefault();
		ev.stopImmediatePropagation();
		const room = this.props.room;
		const username = this.base!.querySelector<HTMLInputElement>('input[name=username]')?.value;
		room.setName(username || '');
	};
	maybeReset = (ev: Event) => {
		const room = this.props.room;
		const username = this.base!.querySelector<HTMLInputElement>('input[name=username]')?.value;
		if (toID(username) !== room.userid) {
			room.setName('');
		}
	};

	override render() {
		const room = this.props.room;
		const showLookup = room.id === 'users';

		return <PSPanelWrapper room={room}><div class="pad">
			{showLookup && <form onSubmit={this.lookup} style={{ minWidth: '278px' }}>
				<label class="label">
					Username: {}
					<input type="search" name="username" class="textbox autofocus" onInput={this.maybeReset} onChange={this.maybeReset} />
				</label>
				{!room.userid && <p class="buttonbar">
					<button type="submit" class="button"><strong>Look up</strong></button> {}
					<button name="closeRoom" class="button">Close</button>
				</p>}
				{!!room.userid && <hr />}
			</form>}

			{this.renderUser()}
		</div></PSPanelWrapper>;
	}
}

class UserOptionsPanel extends PSRoomPanel {
	static readonly id = 'useroptions';
	static readonly routes = ['useroptions-*'];
	static readonly location = 'popup';
	static readonly noURL = true;
	declare state: {
		showMuteInput?: boolean,
		showBanInput?: boolean,
		showConfirm?: boolean,
		requestSent?: boolean,
		data?: Record<string, string>,
	};
	getTargets() {
		const [, targetUser, targetRoomid] = this.props.room.id.split('-');
		let targetRoom = (PS.rooms[targetRoomid] || null) as ChatRoom | null;
		if (targetRoom?.type !== 'chat') targetRoom = null;
		return { targetUser: targetUser as ID, targetRoomid: targetRoomid as RoomID, targetRoom };
	}

	handleMute = (ev: Event) => {
		this.setState({ showMuteInput: true, showBanInput: false });
		ev.preventDefault();
		ev.stopImmediatePropagation();
	};
	handleBan = (ev: Event) => {
		this.setState({ showBanInput: true, showMuteInput: false });
		ev.preventDefault();
		ev.stopImmediatePropagation();
	};

	handleCancel = (ev: Event) => {
		this.setState({ showBanInput: false, showMuteInput: false, showConfirm: false });
		ev.preventDefault();
		ev.stopImmediatePropagation();
	};

	handleConfirm = (ev: Event) => {
		const data = this.state.data;
		if (!data) return;
		const { targetUser, targetRoom } = this.getTargets();

		let cmd = '';
		if (data.action === "Mute") {
			cmd += data.duration === "1 hour" ? "/hourmute " : "/mute ";
			cmd += `${targetUser} ${data.reason ? ',' + data.reason : ''}`;
		} else {
			cmd += data.duration === "1 week" ? "/weekban " : "/ban ";
			cmd += `${targetUser} ${data.reason ? ',' + data.reason : ''}`;
		}
		targetRoom?.send(cmd);
		this.close();
	};

	handleAddFriend = (ev: Event) => {
		const { targetUser, targetRoom } = this.getTargets();
		targetRoom?.send(`/friend add ${targetUser}`);
		this.setState({ requestSent: true });
		ev.preventDefault();
		ev.stopImmediatePropagation();
	};

	handleIgnore = () => {
		const { targetUser, targetRoom } = this.getTargets();
		targetRoom?.send(`/ignore ${targetUser}`);
		this.close();
	};

	muteUser = (ev: Event) => {
		this.setState({ showMuteInput: false });
		const hrMute = (ev.currentTarget as HTMLButtonElement).value === "1hr";
		const reason = this.base?.querySelector<HTMLInputElement>("input[name=mutereason]")?.value;
		const data = {
			action: 'Mute',
			reason,
			duration: hrMute ? "1 hour" : "7 minutes",
		};
		this.setState({ data, showConfirm: true });
		ev.preventDefault();
		ev.stopImmediatePropagation();
	};

	banUser = (ev: Event) => {
		this.setState({ showBanInput: false });
		const weekBan = (ev.currentTarget as HTMLButtonElement).value === "1wk";
		const reason = this.base?.querySelector<HTMLInputElement>("input[name=banreason]")?.value;
		const data = {
			action: 'Ban',
			reason,
			duration: weekBan ? "1 week" : "2 days",
		};
		this.setState({ data, showConfirm: true });
		ev.preventDefault();
		ev.stopImmediatePropagation();
	};

	override render() {
		const room = this.props.room;
		let canMute = false;
		let canBan = false;
		const { targetUser, targetRoom } = this.getTargets();
		if (targetRoom) {
			const banPerms = ["@", "#", "~"];
			const mutePerms = ["%", ...banPerms];
			canMute = mutePerms.includes(targetRoom.users[PS.user.userid]?.charAt(0));
			canBan = banPerms.includes(targetRoom.users[PS.user.userid]?.charAt(0));
		}

		return <PSPanelWrapper room={room} width={280}><div class="pad">
			<p>
				<button onClick={this.handleIgnore} class="button">
					Ignore
				</button>
			</p>
			<p>
				<button data-href={`view-help-request-report-user-${targetUser}`} class="button">
					Report
				</button>
			</p>
			<p>
				{this.state.requestSent ? (
					<button class="button disabled">
						Sent request
					</button>
				) : (
					<button onClick={this.handleAddFriend} class="button">
						Add friend
					</button>
				)}
			</p>
			{(canMute || canBan) && <hr />}
			{this.state.showConfirm && <p>
				<small>
					{this.state.data?.action} <b>{targetUser}</b> {}
					from <b>{targetRoom?.title}</b> for {this.state.data?.duration}?
				</small>
				<p class="buttonbar">
					<button class="button" onClick={this.handleConfirm}>
						<i class="fa fa-confirm"></i> Confirm
					</button> {}
					<button class="button" onClick={this.handleCancel}>
						Cancel
					</button>
				</p>
			</p>}
			<p class="buttonbar">
				{canMute && !this.state.showBanInput && !this.state.showConfirm && (this.state.showMuteInput ? (
					<div>
						<label class="label">
							Reason: {}
							<input name="mutereason" class="textbox autofocus" placeholder="Mute reason (optional)" />
						</label> {} <br />
						<button class="button" onClick={this.muteUser} value="7min">For 7 Mins</button> {}
						<button class="button" onClick={this.muteUser} value="1hr">For 1 Hour</button> {}
						<button class="button" onClick={this.handleCancel}> Cancel</button>
					</div>
				) : (
					<button class="button" onClick={this.handleMute}>
						<i class="fa fa-hourglass-half"></i> Mute
					</button>
				))} {}
				{canBan && !this.state.showMuteInput && !this.state.showConfirm && (this.state.showBanInput ? (
					<div>
						<label class="label">
							Reason: {}
							<input name="banreason" class="textbox autofocus" placeholder="Ban reason (optional)" />
						</label><br />
						<button class="button" onClick={this.banUser} value="2d">For 2 Days</button> {}
						<button class="button" onClick={this.banUser} value="1wk">For 1 Week</button> {}
						<button class="button" onClick={this.handleCancel}>Cancel</button>
					</div>
				) : (
					<button class="button" onClick={this.handleBan}>
						<i class="fa fa-gavel"></i> Ban
					</button>
				))}
			</p>
		</div></PSPanelWrapper>;
	}
}

class VolumePanel extends PSRoomPanel {
	static readonly id = 'volume';
	static readonly routes = ['volume'];
	static readonly location = 'popup';

	setVolume = (e: Event) => {
		const slider = e.currentTarget as HTMLInputElement;
		PS.prefs.set(slider.name as 'effectvolume', Number(slider.value));
		this.forceUpdate();
	};
	setMute = (e: Event) => {
		const checkbox = e.currentTarget as HTMLInputElement;
		PS.prefs.set('mute', !!checkbox.checked);
		PS.update();
	};
	override componentDidMount() {
		super.componentDidMount();
		this.subscriptions.push(PS.prefs.subscribe(() => {
			this.forceUpdate();
		}));
	}
	override render() {
		const room = this.props.room;
		return <PSPanelWrapper room={room}><div class="pad">
			<h3>Volume</h3>
			<p class="volume">
				<label class="optlabel">
					Effects: <span class="value">{!PS.prefs.mute && PS.prefs.effectvolume ? `${PS.prefs.effectvolume}%` : `-`}</span>
				</label>
				{PS.prefs.mute ?
					<em>(muted)</em> :
					<input
						type="range" min="0" max="100" step="1" name="effectvolume" value={PS.prefs.effectvolume}
						onChange={this.setVolume} onInput={this.setVolume} onKeyUp={this.setVolume}
					/>}
			</p>
			<p class="volume">
				<label class="optlabel">
					Music: <span class="value">{!PS.prefs.mute && PS.prefs.musicvolume ? `${PS.prefs.musicvolume}%` : `-`}</span>
				</label>
				{PS.prefs.mute ?
					<em>(muted)</em> :
					<input
						type="range" min="0" max="100" step="1" name="musicvolume" value={PS.prefs.musicvolume}
						onChange={this.setVolume} onInput={this.setVolume} onKeyUp={this.setVolume}
					/>}
			</p>
			<p class="volume">
				<label class="optlabel">
					Notifications: {}
					<span class="value">{!PS.prefs.mute && PS.prefs.notifvolume ? `${PS.prefs.notifvolume}%` : `-`}</span>
				</label>
				{PS.prefs.mute ?
					<em>(muted)</em> :
					<input
						type="range" min="0" max="100" step="1" name="notifvolume" value={PS.prefs.notifvolume}
						onChange={this.setVolume} onInput={this.setVolume} onKeyUp={this.setVolume}
					/>}
			</p>
			<p>
				<label class="checkbox">
					<input type="checkbox" name="mute" checked={PS.prefs.mute} onChange={this.setMute} /> Mute all
				</label>
			</p>
		</div></PSPanelWrapper>;
	}
}

class OptionsPanel extends PSRoomPanel {
	static readonly id = 'options';
	static readonly routes = ['options'];
	static readonly location = 'popup';
	declare state: { showStatusInput?: boolean, showStatusUpdated?: boolean };

	override componentDidMount() {
		super.componentDidMount();
		this.subscribeTo(PS.user);
	}
	setTheme = (e: Event) => {
		const theme = (e.currentTarget as HTMLSelectElement).value as 'light' | 'dark' | 'system';
		PS.prefs.set('theme', theme);
		this.forceUpdate();
	};
	setLayout = (e: Event) => {
		const layout = (e.currentTarget as HTMLSelectElement).value;
		switch (layout) {
		case '':
			PS.prefs.set('onepanel', null);
			PS.rightPanel ||= PS.rooms['rooms'] || null;
			break;
		case 'onepanel':
			PS.prefs.set('onepanel', true);
			break;
		case 'vertical':
			PS.prefs.set('onepanel', 'vertical');
			break;
		}
		PS.update();
	};
	setChatroomTimestamp = (ev: Event) => {
		const timestamp = (ev.currentTarget as HTMLSelectElement).value as TimestampOptions;
		PS.prefs.set('timestamps', { ...PS.prefs.timestamps, chatrooms: timestamp || undefined });
	};
	setPMsTimestamp = (ev: Event) => {
		const timestamp = (ev.currentTarget as HTMLSelectElement).value as TimestampOptions;
		PS.prefs.set('timestamps', { ...PS.prefs.timestamps, pms: timestamp || undefined });
	};

	handleShowStatusInput = (ev: Event) => {
		ev.preventDefault();
		ev.stopImmediatePropagation();
		this.setState({ showStatusInput: !this.state.showStatusInput });
	};

	handleOnChange = (ev: Event) => {
		let elem = ev.currentTarget as HTMLInputElement;
		let setting = elem.name;
		let value = elem.checked;
		switch (setting) {
		case 'blockPMs': {
			PS.prefs.set("blockPMs", value);
			PS.send(value ? '/blockpms' : '/unblockpms');
			break;
		}
		case 'blockChallenges': {
			PS.prefs.set("blockChallenges", value);
			PS.send(value ? '/blockchallenges' : '/unblockchallenges');
			break;
		}
		case 'bwgfx': {
			PS.prefs.set('bwgfx', value);
			Dex.loadSpriteData(value || PS.prefs.noanim ? 'bw' : 'xy');
			break;
		}
		case 'language': {
			PS.prefs.set(setting, elem.value);
			PS.send('/language ' + elem.value);
			break;
		}
		case 'tournaments': {
			if (elem.value === "hide") PS.prefs.set(setting, elem.value);
			if (elem.value === "notify") PS.prefs.set(setting, elem.value);
			if (!elem.value) PS.prefs.set(setting, null);
			break;
		}
		case 'refreshprompt':
		case 'noanim':
		case 'nopastgens':
		case 'noselfhighlight':
		case 'leavePopupRoom':
		case 'inchatpm':
			PS.prefs.set(setting, value);
			break;
		}
	};

	editStatus = (ev: Event) => {
		const statusInput = this.base!.querySelector<HTMLInputElement>('input[name=statustext]');
		PS.send(statusInput?.value?.length ? `|/status ${statusInput.value}` : `|/clearstatus`);
		this.setState({ showStatusUpdated: true, showStatusInput: false });
		ev.preventDefault();
		ev.stopImmediatePropagation();
	};

	override render() {
		const room = this.props.room;
		return <PSPanelWrapper room={room}><div class="pad">
			<p>
				<img
					class="trainersprite yours" width="40" height="40" style={{ verticalAlign: 'middle' }}
					src={Dex.resolveAvatar(`${PS.user.avatar}`)} data-href="avatars"
				/> {}
				<strong>{PS.user.name}</strong>
			</p>
			<p>
				<button class="button" data-href="avatars"> Avatar...</button>
			</p>

			{this.state.showStatusInput ? (
				<p>
					<input name="statustext" />
					<button class="button" onClick={this.editStatus}><i class="fa fa-pencil"></i></button>
				</p>
			) : (
				<p>
					<button class="button" onClick={this.handleShowStatusInput} disabled={this.state.showStatusUpdated}>
						{this.state.showStatusUpdated ? 'Status Updated' : 'Status...'}</button>
				</p>
			)}

			{PS.user.named && (PS.user.registered?.userid === PS.user.userid ?
				<button className="button" data-href="changepassword">Password...</button> :
				<button className="button" data-href="register">Register</button>)}

			<hr />
			<h3>Graphics</h3>
			<p>
				<label class="optlabel">Theme: <select name="theme" class="button" onChange={this.setTheme}>
					<option value="light" selected={PS.prefs.theme === 'light'}>Light</option>
					<option value="dark" selected={PS.prefs.theme === 'dark'}>Dark</option>
					<option value="system" selected={PS.prefs.theme === 'system'}>Match system theme</option>
				</select></label>
			</p>
			<p>
				<label class="optlabel">Layout: <select name="layout" class="button" onChange={this.setLayout}>
					<option value="" selected={!PS.prefs.onepanel}>Two panels (if wide enough)</option>
					<option value="onepanel" selected={PS.prefs.onepanel === true}>Single panel</option>
					<option value="vertical" selected={PS.prefs.onepanel === 'vertical'}>Vertical tabs</option>
				</select></label>
			</p>
			<p>
				<label class="optlabel">
					Background: <button class="button" data-href="changebackground">
						Change Background
					</button>
				</label>
			</p>
			<p>
				<label class="checkbox"> <input
					name="noanim" checked={PS.prefs.noanim || false} type="checkbox" onChange={this.handleOnChange}
				/> Disable animations</label>
			</p>
			<p>
				<label class="checkbox"><input
					name="bwgfx" checked={PS.prefs.bwgfx || false} type="checkbox" onChange={this.handleOnChange}
				/>  Use 2D sprites instead of 3D models</label>
			</p>
			<p>
				<label class="checkbox"><input
					name="nopastgens" checked={PS.prefs.nopastgens || false} type="checkbox" onChange={this.handleOnChange}
				/> Use modern sprites for past generations</label>
			</p>
			<hr />
			<h3>Chat</h3>
			<p>
				<label class="checkbox"><input
					name="blockPMs" checked={PS.prefs.blockPMs || false} type="checkbox" onChange={this.handleOnChange}
				/> Block PMs</label>
			</p>
			<p>
				<label class="checkbox"><input
					name="blockChallenges" checked={PS.prefs.blockChallenges || false} type="checkbox" onChange={this.handleOnChange}
				/> Block challenges</label>
			</p>
			<p>
				<label class="checkbox"><input
					name="inchatpm" checked={PS.prefs.inchatpm || false} type="checkbox" onChange={this.handleOnChange}
				/> Show PMs in chatrooms</label>
			</p>
			<p>
				<label class="checkbox"><input
					name="noselfhighlight" checked={PS.prefs.noselfhighlight || false} type="checkbox" onChange={this.handleOnChange}
				/> Do not highlight when your name is said in chat</label>
			</p>
			<p>
				<label class="checkbox"><input
					name="leavePopupRoom" checked={PS.prefs.leavePopupRoom || false} type="checkbox" onChange={this.handleOnChange}
				/> Confirm before leaving a room</label>
			</p>
			<p>
				<label class="checkbox"><input
					name="refreshprompt" checked={PS.prefs.refreshprompt || false} type="checkbox" onChange={this.handleOnChange}
				/> Confirm before refreshing</label>
			</p>
			<p>
				<label class="optlabel">
					Language: {}
					<select name="language" onChange={this.handleOnChange} class="button">
						<option value="german" selected={PS.prefs.language === "german"}>Deutsch</option>
						<option value="english" selected={PS.prefs.language === "english"}>English</option>
						<option value="spanish" selected={PS.prefs.language === "spanish"}>Español</option>
						<option value="french" selected={PS.prefs.language === "french"}>Français</option>
						<option value="italian" selected={PS.prefs.language === "italian"}>Italiano</option>
						<option value="dutch" selected={PS.prefs.language === "dutch"}>Nederlands</option>
						<option value="portuguese" selected={PS.prefs.language === "portuguese"}>Português</option>
						<option value="turkish" selected={PS.prefs.language === "turkish"}>Türkçe</option>
						<option value="hindi" selected={PS.prefs.language === "hindi"}>हिंदी</option>
						<option value="japanese" selected={PS.prefs.language === "japanese"}>日本語</option>
						<option value="simplifiedchinese" selected={PS.prefs.language === "simplifiedchinese"}>简体中文</option>
						<option value="traditionalchinese" selected={PS.prefs.language === "traditionalchinese"}>中文</option>
					</select>
				</label>
			</p>
			<p>
				<label class="optlabel">
					Tournaments: <select name="tournaments" class="button" onChange={this.handleOnChange}>
						<option value="" selected={!PS.prefs.tournaments}>No notifications</option>
						<option value="notify" selected={PS.prefs.tournaments === "notify"}>Notifications</option>
						<option value="hide" selected={PS.prefs.tournaments === "hide"}>Hide</option>
					</select>
				</label>
			</p>
			<p>
				<label class="optlabel">Timestamps: <select name="layout" class="button" onChange={this.setChatroomTimestamp}>
					<option value="" selected={!PS.prefs.timestamps.chatrooms}>Off</option>
					<option value="minutes" selected={PS.prefs.timestamps.chatrooms === "minutes"}>[HH:MM]</option>
					<option value="seconds" selected={PS.prefs.timestamps.chatrooms === "seconds"}>[HH:MM:SS]</option>
				</select></label>
			</p>
			<p>
				<label class="optlabel">Timestamps in DMs: <select name="layout" class="button" onChange={this.setPMsTimestamp}>
					<option value="" selected={!PS.prefs.timestamps.pms}>Off</option>
					<option value="minutes" selected={PS.prefs.timestamps.pms === "minutes"}>[HH:MM]</option>
					<option value="seconds" selected={PS.prefs.timestamps.pms === "seconds"}>[HH:MM:SS]</option>
				</select></label>
			</p>
			<p>
				<label class="optlabel">
					Chat preferences: {}
					<button class="button" data-href="chatformatting">Text formatting...</button>
				</label>
			</p>
			<hr />
			{PS.user.named ? <p class="buttonbar" style="text-align: right">
				<button class="button" data-href="login"><i class="fa fa-pencil"></i> Change name</button> {}
				<button class="button" data-cmd="/logout"><i class="fa fa-power-off"></i> Log out</button>
			</p> : <p class="buttonbar" style="text-align: right">
				<button class="button" data-href="login"><i class="fa fa-pencil"></i> Choose name</button>
			</p> }
		</div></PSPanelWrapper>;
	}
}

class GooglePasswordBox extends preact.Component<{ name: string }> {
	override componentDidMount() {
		window.gapiCallback = (response: any) => {
			PS.user.changeNameWithPassword(this.props.name, response.credential, { needsGoogle: true });
		};

		PS.user.gapiLoaded = true;
		const script = document.createElement('script');
		script.async = true;
		script.src = 'https://accounts.google.com/gsi/client';
		document.getElementsByTagName('head')[0].appendChild(script);
	}
	override render() {
		return <div class="google-password-box">
			<div
				id="g_id_onload" data-client_id="912270888098-jjnre816lsuhc5clj3vbcn4o2q7p4qvk.apps.googleusercontent.com"
				data-context="signin" data-ux_mode="popup" data-callback="gapiCallback" data-auto_prompt="false"
			></div>
			<div
				class="g_id_signin" data-type="standard" data-shape="pill" data-theme="filled_blue" data-text="continue_with"
				data-size="large" data-logo_alignment="left" data-auto_select="true" data-itp_support="true"
				style="width:fit-content;margin:0 auto"
			>[loading Google log-in button]</div>
		</div>;
	}
}

class LoginPanel extends PSRoomPanel {
	static readonly id = 'login';
	static readonly routes = ['login'];
	static readonly location = 'semimodal-popup';
	declare state: { passwordShown?: boolean };

	override componentDidMount() {
		super.componentDidMount();
		this.subscriptions.push(PS.user.subscribe(args => {
			if (args) {
				if (args.success) {
					this.close();
					return;
				}
				this.props.room.args = args;
				setTimeout(() => this.focus(), 1);
			}
			this.forceUpdate();
		}));
	}
	getUsername() {
		const loginName = PS.user.loggingIn || this.props.room.args?.name as string;
		if (loginName) return loginName;

		const input = this.base?.querySelector<HTMLInputElement>('input[name=username]');
		if (input && !input.disabled) {
			return input.value;
		}
		return PS.user.named ? PS.user.name : '';
	}
	handleSubmit = (ev: Event) => {
		ev.preventDefault();
		const passwordBox = this.base!.querySelector<HTMLInputElement>('input[name=password]');
		if (passwordBox) {
			PS.user.changeNameWithPassword(this.getUsername(), passwordBox.value);
		} else {
			PS.user.changeName(this.getUsername());
		}
	};
	update = () => {
		this.forceUpdate();
	};
	override focus() {
		const passwordBox = this.base!.querySelector<HTMLInputElement>('input[name=password]');
		const usernameBox = this.base!.querySelector<HTMLInputElement>('input[name=username]');
		(passwordBox || usernameBox)?.select();
	}
	reset = (ev: Event) => {
		ev.preventDefault();
		ev.stopImmediatePropagation();
		this.props.room.args = null;
		this.forceUpdate();
	};
	handleShowPassword = (ev: Event) => {
		ev.preventDefault();
		ev.stopImmediatePropagation();
		this.setState({ passwordShown: !this.state.passwordShown });
	};
	override render() {
		const room = this.props.room;
		const loginState = room.args as PSLoginState;
		return <PSPanelWrapper room={room} width={280}><div class="pad">
			<h3>Log in</h3>
			<form onSubmit={this.handleSubmit}>
				{loginState?.error && <p class="error">{loginState.error}</p>}
				<p><label class="label">
					Username: <small class="preview" style={{ color: BattleLog.usernameColor(toID(this.getUsername())) }}>(color)</small>
					<input
						class="textbox" type="text" name="username"
						onInput={this.update} onChange={this.update} autocomplete="username"
						value={this.getUsername()} disabled={!!PS.user.loggingIn || !!loginState?.name}
					/>
				</label></p>
				{PS.user.named && !loginState && <p>
					<small>(Others will be able to see your name change. To change name privately, use "Log out")</small>
				</p>}
				{loginState?.needsPassword && <p>
					<i class="fa fa-level-up fa-rotate-90"></i> <strong>if you registered this name:</strong>
					<label class="label">
						Password: {}
						<input
							class="textbox" type={this.state.passwordShown ? 'text' : 'password'} name="password"
							autocomplete="current-password" style="width:173px"
						/>
						<button
							type="button" onClick={this.handleShowPassword} aria-label="Show password"
							class="button" style="float:right;margin:-21px 0 10px;padding: 2px 6px"
						><i class="fa fa-eye"></i></button>
					</label>
				</p>}
				{loginState?.needsGoogle && <>
					<p><i class="fa fa-level-up fa-rotate-90"></i> <strong>if you registered this name:</strong></p>
					<p><GooglePasswordBox name={this.getUsername()} /></p>
				</>}
				<p class="buttonbar">
					{PS.user.loggingIn ? (
						<button disabled class="cur">Logging in...</button>
					) : loginState?.needsPassword ? (
						<>
							<button type="submit" class="button"><strong>Log in</strong></button> {}
							<button type="button" onClick={this.reset} class="button">Cancel</button>
						</>
					) : loginState?.needsGoogle ? (
						<button type="button" onClick={this.reset} class="button">Cancel</button>
					) : (
						<>
							<button type="submit" class="button"><strong>Choose name</strong></button> {}
							<button type="button" name="closeRoom" class="button">Cancel</button>
						</>
					)} {}
				</p>
				{loginState?.name && <div>
					<p>
						<i class="fa fa-level-up fa-rotate-90"></i> <strong>if not:</strong>
					</p>
					<p style={{ maxWidth: '210px', margin: '0 auto' }}>
						This is someone else's account. Sorry.
					</p>
					<p class="buttonbar">
						<button class="button" onClick={this.reset}>Try another name</button>
					</p>
				</div>}
			</form>
		</div></PSPanelWrapper>;
	}
}

class AvatarsPanel extends PSRoomPanel {
	static readonly id = 'avatars';
	static readonly routes = ['avatars'];
	static readonly location = 'semimodal-popup';

	handleAvatar = (ev: Event) => {
		let curtarget = ev.currentTarget as HTMLButtonElement;
		let avatar = curtarget.value;
		if (window.BattleAvatarNumbers) {
			if (window.BattleAvatarNumbers[avatar]) avatar = window.BattleAvatarNumbers[avatar];
		}
		PS.rooms['']?.send('/avatar ' + avatar);
		PS.user.avatar = avatar;
		ev.preventDefault();
		this.close();
	};

	update = () => {
		this.forceUpdate();
	};

	override render() {
		const room = this.props.room;
		let avatars: number[] = [];
		let cur = Number(PS.user.avatar);

		for (let i = 1; i <= 293; i++) {
			if (i === 162 || i === 168) continue;
			avatars.push(i);
		}

		return <PSPanelWrapper room={room} width={1210}><div class="pad">
			<label class="optlabel"><strong>Choose an avatar or </strong>
				<button class="button" onClick={() => this.close()}> Cancel</button>
			</label>
			<div class="avatarlist">
				{avatars.map(i => {
					const offset = `-${((i - 1) % 16) * 80 + 1}px -${Math.floor((i - 1) / 16) * 80 + 1}px`;
					const style = {
						backgroundPosition: offset,
					};
					const className = `option pixelated${i === cur ? ' cur' : ''}`;

					return (
						<button
							key={i}
							value={i}
							style={style}
							className={className}
							title={`/avatar ${i}`}
							onClick={this.handleAvatar}
						/>
					);
				})}

			</div>
			<div style="clear:left"></div>
			<p><button class="button" data-cmd="/close">Cancel</button></p>
		</div></PSPanelWrapper>;
	}
}

class BattleForfeitPanel extends PSRoomPanel {
	static readonly id = 'forfeit';
	static readonly routes = ['forfeitbattle'];
	static readonly location = 'semimodal-popup';
	static readonly noURL = true;

	handleForfeit = (ev: Event) => {
		const elem = this.props.room.parentElem;
		const roomid = (elem as HTMLInputElement)?.value as RoomID || PS.getRoom(elem)?.id || '' as RoomID;
		const room = PS.rooms[roomid] as BattleRoom;

		const closeAfter = this.base!.querySelector<HTMLInputElement>('input[name=closeroom]')?.checked;
		room.send("/forfeit");
		if (closeAfter) PS.leave(room.id);
		ev.preventDefault();
		this.close();
	};

	update = () => {
		this.forceUpdate();
	};

	override render() {
		const room = this.props.room;
		const elem = room.parentElem;
		const roomid = (elem as HTMLInputElement)?.value as RoomID || PS.getRoom(elem)?.id || '' as RoomID;
		const battleRoom = PS.rooms[roomid] as BattleRoom;

		return <PSPanelWrapper room={room} width={480}><div class="pad">
			<form>
				<p>Forfeiting makes you lose the battle. Are you sure?</p>
				<p>
					<label class="checkbox"><input type="checkbox" name="closeroom" checked={true} /> Close after
						forfeiting</label>
				</p>
				<p>
					<button onClick={this.handleForfeit} class="button"><strong>Forfeit</strong></button> {}
					{!battleRoom.battle.rated && <button type="button" value={battleRoom.id} data-href="replaceplayer" class="button">
						Replace player
					</button>} {}
					<button type="button" name="close" data-cmd="/close" class="button">
						Cancel
					</button>
				</p>
			</form>
		</div></PSPanelWrapper>;
	}
}

class ReplacePlayerPanel extends PSRoomPanel {
	static readonly id = 'replaceplayer';
	static readonly routes = ['replaceplayer'];
	static readonly location = 'semimodal-popup';
	static readonly noURL = true;

	handleReplacePlayer = (ev: Event) => {
		const elem = this.props.room.parentElem;
		const roomid = (elem as HTMLInputElement)?.value as RoomID || PS.getRoom(elem)?.id || '' as RoomID;
		const room = PS.rooms[roomid] as BattleRoom;
		const newPlayer = this.base?.querySelector<HTMLInputElement>("input[name=newplayer]")?.value;
		if (!newPlayer?.length) return room.add("|error|Enter player's name");
		if (room.battle.ended) return room.add("|error|Cannot replace player, battle has already ended.");
		let playerSlot = room.battle.p1.id === PS.user.userid ? "p1" : "p2";
		room.send('/leavebattle');
		room.send(`/addplayer ${newPlayer}, ${playerSlot}`);
		this.close();
		ev.preventDefault();
	};

	update = () => {
		this.forceUpdate();
	};

	override render() {
		const room = this.props.room;

		return <PSPanelWrapper room={room} width={480}><div class="pad">
			<form onSubmit={this.handleReplacePlayer}>
				<p>Replacement player's name:</p>
				<p>
					<input name="newplayer" class="textbox autofocus" />
				</p>
				<p>
					<button type="submit" class="button">
						<strong>Replace</strong>
					</button> {}
					<button type="button" data-cmd="/close" class="button">
						Cancel
					</button>
				</p>
			</form>
		</div></PSPanelWrapper>;
	}
}

class ChangePasswordPanel extends PSRoomPanel {
	static readonly id = "changepassword";
	static readonly routes = ["changepassword"];
	static readonly location = "semimodal-popup";
	static readonly noURL = true;

	declare state: { errorMsg: string };

	update = () => {
		this.forceUpdate();
	};

	handleChangePassword = (ev: Event) => {
		ev.preventDefault();
		let oldpassword = this.base?.querySelector<HTMLInputElement>('input[name=oldpassword]')?.value;
		let password = this.base?.querySelector<HTMLInputElement>('input[name=password]')?.value;
		let cpassword = this.base?.querySelector<HTMLInputElement>('input[name=cpassword]')?.value;
		if (!oldpassword?.length ||
			!password?.length ||
			!cpassword?.length) return this.setState({ errorMsg: "All fields are required" });
		if (password !== cpassword) return this.setState({ errorMsg: 'Passwords do not match' });
		PSLoginServer.query("changepassword", {
			oldpassword,
			password,
			cpassword,
		}).then(data => {
			if (data?.actionerror) return this.setState({ errorMsg: data?.actionerror });
			PS.alert("Your password was successfully changed!");

		}).catch(err => {
			console.error(err);
			this.setState({ errorMsg: err.message });
		});

		this.setState({ errorMsg: '' });
	};

	override render() {
		const room = this.props.room;

		return <PSPanelWrapper room={room} width={280}><div class="pad">
			<form onSubmit={this.handleChangePassword}>
				{ !!this.state.errorMsg?.length && <p>
					<b class="message-error"> {this.state.errorMsg}</b>
				</p> }
				<p>Change your password:</p>
				<p>
					<label class="label">
						Username: {}
						<input name="username" value={PS.user.name} readOnly={true} autocomplete="username" class="textbox disabled" />
					</label>
				</p>
				<p>
					<label class="label">
						Old password: {}
						<input name="oldpassword" type="password" autocomplete="current-password" class="textbox autofocus" />
					</label>
				</p>
				<p>
					<label class="label">
						New password: {}
						<input name="password" type="password" autocomplete="new-password" class="textbox" />
					</label>
				</p>
				<p>
					<label class="label">
						New password (confirm): {}
						<input name="cpassword" type="password" autocomplete="new-password" class="textbox" />
					</label>
				</p>
				<p class="buttonbar">
					<button type="submit" class="button">
						<strong>Change password</strong>
					</button> {}
					<button type="button" data-cmd="/close" class="button">Cancel</button>
				</p>
			</form>
		</div>
		</PSPanelWrapper>;
	}
}

class RegisterPanel extends PSRoomPanel {
	static readonly id = "register";
	static readonly routes = ["register"];
	static readonly location = "semimodal-popup";
	static readonly noURL = true;
	static readonly rightPopup = true;

	declare state: { errorMsg: string };

	handleRegisterUser = (ev: Event) => {
		ev.preventDefault();
		let captcha = this.base?.querySelector<HTMLInputElement>('input[name=captcha]')?.value;
		let password = this.base?.querySelector<HTMLInputElement>('input[name=password]')?.value;
		let cpassword = this.base?.querySelector<HTMLInputElement>('input[name=cpassword]')?.value;
		if (!captcha?.length ||
			!password?.length ||
			!cpassword?.length) return this.setState({ errorMsg: "All fields are required" });
		if (password !== cpassword) return this.setState({ errorMsg: 'Passwords do not match' });
		PSLoginServer.query("register", {
			captcha,
			password,
			cpassword,
			username: PS.user.name,
			challstr: PS.user.challstr,
		}).then(data => {
			if (data?.actionerror) this.setState({ errorMsg: data?.actionerror });
			if (data?.curuser?.loggedin) {
				let name = data.curuser.username;
				PS.user.registered = { name, userid: toID(name) };
				if (data?.assertion) PS.user.handleAssertion(name, data?.assertion);
				this.close();
				PS.alert("You have been successfully registered.");
			}
		}).catch(err => {
			console.error(err);
			this.setState({ errorMsg: err.message });
		});

		this.setState({ errorMsg: '' });
	};

	override render() {
		const room = this.props.room;

		return <PSPanelWrapper room={room} width={280}><div class="pad">
			<form onSubmit={this.handleRegisterUser}>
				{ !!this.state.errorMsg?.length && <p>
					<b class="message-error"> {this.state.errorMsg}</b>
				</p> }
				<p>Register your account:</p>
				<p>
					<label class="label">
						Username: {}
						<input name="name" value={PS.user.name} readOnly={true} autocomplete="username" class="textbox disabled" />
					</label>
				</p>
				<p>
					<label class="label">
						Password: {}
						<input name="password" type="password" autocomplete="new-password" class="textbox autofocus" />
					</label>
				</p>
				<p>
					<label class="label">
						Password (confirm): {}
						<input name="cpassword" type="password" autocomplete="new-password" class="textbox" />
					</label>
				</p>
				<p>
					<label class="label"><img
						src="https://play.pokemonshowdown.com/sprites/gen5ani/pikachu.gif"
						alt="An Electric-type mouse that is the mascot of the Pokémon franchise."
					/></label>
				</p>
				<p>
					<label class="label">
						What is this pokemon?{}
						<input name="captcha" class="textbox" />
					</label>
				</p>
				<p class="buttonbar">
					<button type="submit" class="button"><strong>Register</strong></button> {}
					<button type="button" data-cmd="/close" class="button">Cancel</button>
				</p>
			</form>

		</div>
		</PSPanelWrapper>;
	}
}

class BackgroundListPanel extends PSRoomPanel {
	static readonly id = 'changebackground';
	static readonly routes = ['changebackground'];
	static readonly location = 'semimodal-popup';
	static readonly noURL = true;

	setBg = (ev: Event) => {
		let curtarget = ev.currentTarget as HTMLButtonElement;
		let bg = curtarget.value;
		let bgs = ['horizon', 'ocean', 'waterfall', 'shaymin', 'charizards'];
		if (!bg.length) bg = bgs[Math.floor(Math.random() * 5)];
		PSBackground.set('', bg);
		ev.preventDefault();
		ev.stopImmediatePropagation();
		this.close();
	};

	uploadBg = (ev: Event) => {
		const input = this.base?.querySelector<HTMLInputElement>('input[name=bgfile]');
		if (!input?.files?.[0]) return;

		const file = input.files[0];
		const reader = new FileReader();

		reader.onload = () => {
			const base64Image = reader.result as string;
			PSBackground.set(base64Image, 'custom', null);
			this.close();
		};

		reader.onerror = () => {
			console.error("Failed to read file.");
			const status = this.base?.querySelector<HTMLElement>('.bgstatus');
			if (status) status.textContent = "Failed to load background image.";

			this.close();
		};
		reader.readAsDataURL(file);
		ev.preventDefault();
		ev.stopImmediatePropagation();
	};

	override render() {
		const room = this.props.room;
		return <PSPanelWrapper room={room} width={480}><div class="pad">
			<p><strong>Default</strong></p>
			<div class="bglist">
				<button onClick={this.setBg} value="" class="option cur">
					<strong
						style="
						background: #888888;
						color: white;
						padding: 16px 18px;
						display: block;
						font-size: 12pt;
					"
					>Random</strong>
				</button>
			</div>
			<div style="clear: left"></div>
			<p><strong>Official</strong></p>
			<div class="bglist">
				<button onClick={this.setBg} value="charizards" class="option">
					<span class="bg" style="background-position: 0 -0px"></span>{' '}
					Charizards
				</button>
				<button onClick={this.setBg} value="horizon" class="option">
					<span class="bg" style="background-position: 0 -90px"></span>{' '}
					Horizon
				</button>
				<button onClick={this.setBg} value="waterfall" class="option">
					<span class="bg" style="background-position: 0 -180px"></span>{' '}
					Waterfall
				</button>
				<button onClick={this.setBg} value="ocean" class="option">
					<span class="bg" style="background-position: 0 -270px"></span>{' '}
					Ocean
				</button>
				<button onClick={this.setBg} value="shaymin" class="option">
					<span class="bg" style="background-position: 0 -360px"></span>{' '}
					Shaymin
				</button>
				<button onClick={this.setBg} value="solidblue" class="option">
					<span class="bg" style="background: #344b6c"></span>Solid blue
				</button>
			</div>
			<div style="clear: left"></div>
			<p><strong>Custom</strong></p>
			<p>
				Drag and drop an image to PS (the background settings don't need to be
				open), or upload:
			</p>
			<p><input type="file" accept="image/*" name="bgfile" /></p>
			<p class="bgstatus"></p>
			<p>
				<button onClick={this.uploadBg} class="button"><strong>Done</strong></button>
			</p>
		</div>
		</PSPanelWrapper>;
	}
}

class ChatFormattingPanel extends PSRoomPanel {
	static readonly id = 'chatformatting';
	static readonly routes = ['chatformatting'];
	static readonly location = 'semimodal-popup';
	static readonly noURL = true;

	handleOnChange = (ev: Event) => {
		const setting = "hide" + (ev.currentTarget as HTMLInputElement).name;
		const value = (ev.currentTarget as HTMLInputElement).checked;
		let curPref = PS.prefs.chatformatting;
		curPref[setting] = value;
		PS.prefs.set("chatformatting", curPref);
		ev.preventDefault();
		ev.stopImmediatePropagation();
	};

	override render() {
		const room = this.props.room;
		return <PSPanelWrapper room={room} width={480}><div class="pad">
			<p>Usable formatting:</p>
			<p>**<strong>bold</strong>** (<kbd>Ctrl</kbd> + <kbd>B</kbd>)</p>
			<p>__<em>italics</em>__ (<kbd>Ctrl</kbd> + <kbd>I</kbd>)</p>
			<p>``<code>code formatting</code>`` (<kbd>Ctrl</kbd> + <kbd>`</kbd>)</p>
			<p>~~<s>strikethrough</s>~~</p>
			<p>^^<sup>superscript</sup>^^</p>
			<p>\\<sub>subscript</sub>\\</p>
			<p>
				<label class="checkbox">
					<input
						onChange={this.handleOnChange}
						type="checkbox"
						name="greentext"
						checked={PS.prefs.chatformatting.hidegreentext}
					/> Suppress{' '}
					<span class="greentext">&gt;greentext</span>
				</label>
			</p>
			<p>
				<label class="checkbox">
					<input
						onChange={this.handleOnChange}
						type="checkbox"
						name="me"
						checked={PS.prefs.chatformatting.hideme}

					/> Suppress <code>/me</code> <em>action formatting</em>
				</label>
			</p>
			<p>
				<label class="checkbox">
					<input
						onChange={this.handleOnChange}
						type="checkbox"
						name="spoiler"
						checked={PS.prefs.chatformatting.hidespoiler}
					/> Auto-show spoilers:{' '}
					<span class="spoiler">these things</span>
				</label>
			</p>
			<p>
				<label class="checkbox">
					<input
						onChange={this.handleOnChange}
						type="checkbox"
						name="links"
						checked={PS.prefs.chatformatting.hidelinks}
					/> Make [[clickable links]]
					unclickable
				</label>
			</p>
			<p>
				<label class="checkbox">
					<input
						onChange={this.handleOnChange}
						type="checkbox"
						name="interstice"
						checked={PS.prefs.chatformatting.hideinterstice}
					/> Don't warn for untrusted links
				</label>
			</p>
			<p><button data-cmd="/close" class="button">Done</button></p>
		</div>
		</PSPanelWrapper>;
	}
}

class LeaveRoomPanel extends PSRoomPanel {
	static readonly id = 'confirmleaveroom';
	static readonly routes = ['confirmleaveroom'];
	static readonly location = 'semimodal-popup';
	static readonly noURL = true;

	override render() {
		const room = this.props.room;
		const parentRoomId = (this.props.room.parentElem as HTMLInputElement).value;
		return <PSPanelWrapper room={room} width={480}><div class="pad">
			<p>Are you sure you want to exit this room?</p>
			<p class="buttonbar">
				<button data-cmd={`/close ${parentRoomId}`} class="button autofocus">
					<strong>Close Room</strong>
				</button> {}
				<button data-cmd="/close" class="button">
					<strong>Cancel</strong>
				</button>
			</p>
		</div></PSPanelWrapper>;
	}
}

class PopupPanel extends PSRoomPanel {
	static readonly id = 'popup';
	static readonly routes = ['popup-*'];
	static readonly location = 'semimodal-popup';
	static readonly noURL = true;

	override render() {
		const room = this.props.room;
		const okButtonLabel = room.args?.okButtonLabel as string || 'OK';
		return <PSPanelWrapper room={room} width={480}><div class="pad">
			{room.args?.message && <p
				style="white-space:pre-wrap;word-wrap:break-word"
				dangerouslySetInnerHTML={{ __html: BattleLog.parseMessage(room.args.message as string) }}
			></p>}
			<p class="buttonbar">
				<button class="button autofocus" name="closeRoom" style="min-width:50px"><strong>{okButtonLabel}</strong></button>
			</p>
		</div></PSPanelWrapper>;
	}
}

class RoomTabListPanel extends PSRoomPanel {
	static readonly id = 'roomtablist';
	static readonly routes = ['roomtablist'];
	static readonly location = 'semimodal-popup';
	static readonly noURL = true;

	override render() {
		return <PSPanelWrapper room={this.props.room}><div class="tablist">
			<ul>
				{PS.leftRoomList.map(roomid => PSHeader.renderRoomTab(roomid))}
			</ul>
			<ul>
				{PS.rightRoomList.map(roomid => PSHeader.renderRoomTab(roomid))}
			</ul>
		</div></PSPanelWrapper>;
	}
}

PS.addRoomType(
	UserPanel,
	UserOptionsPanel,
	VolumePanel,
	OptionsPanel,
	LoginPanel,
	AvatarsPanel,
	ChangePasswordPanel,
	RegisterPanel,
	BattleForfeitPanel,
	ReplacePlayerPanel,
	BackgroundListPanel,
	LeaveRoomPanel,
	ChatFormattingPanel,
	PopupPanel,
	RoomTabListPanel
);
