import Gio      from 'gi://Gio';
import GLib     from 'gi://GLib';
import St       from 'gi://St';
import GObject  from 'gi://GObject';
import Atk      from 'gi://Atk';

import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as Main      from 'resource:///org/gnome/shell/ui/main.js';
import { Extension }  from 'resource:///org/gnome/shell/extensions/extension.js';

const IndicatorName = "KerioToggle";
const SERVICE = 'kerio-kvc';
const REFRESH_INTERVAL = 2;

const KerioToggle = GObject.registerClass(
class KerioToggle extends PanelMenu.Button {
    _init(extension) {
        super._init(null, IndicatorName);
        this._extension = extension;

        this.accessible_role = Atk.Role.TOGGLE_BUTTON;

        this._icon = new St.Icon({
            gicon: Gio.icon_new_for_string(this._iconPath('off')),
            style_class: 'system-status-icon',
        });
        this.add_child(this._icon);

        this.connect('button-press-event', () => this._toggle());

        this._refresh();

        this._timer = GLib.timeout_add_seconds(
            GLib.PRIORITY_DEFAULT, REFRESH_INTERVAL,
            () => { this._refresh(); return GLib.SOURCE_CONTINUE; });
    }

    _iconPath(state) {
        console.log(`${this._extension.path}/icons/kerio-${state}-symbolic.png`);
        return `${this._extension.path}/icons/kerio-${state}-symbolic.png`;
    }

    _isActive() {
        try {
            const proc = Gio.Subprocess.new(
                ['systemctl', 'is-active', '--quiet', SERVICE],
                Gio.SubprocessFlags.NONE
            );
            let result = proc.wait_check(null);
            console.log(result);
            return result; // returns true if active
        } catch {
            return false;
        }
    }

    _run(cmd) {
        Gio.Subprocess.new(
            ['pkexec', 'bash', '-c', cmd],
            Gio.SubprocessFlags.NONE
        );
    }

    _toggle() {
        let isActive = this._isActive();
        console.log(`toggle: ${isActive}`);
        if (isActive) {
            this._run(`systemctl stop ${SERVICE}`);
        } else {
            this._run(`systemctl start ${SERVICE}`);
        }

        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._refresh();
            return GLib.SOURCE_REMOVE;
        });
    }

    _refresh() {
        const state = this._isActive() ? 'on' : 'off';
        console.log(`refresh: ${state}`);
        this._icon.gicon = Gio.icon_new_for_string(this._iconPath(state));
    }

    destroy() {
        if (this._timer) {
            GLib.source_remove(this._timer);
            this._timer = null;
        }
        super.destroy();
    }
});

export default class KerioToggleExtension extends Extension {
    enable() {
        this._indicator = new KerioToggle(this);
        Main.panel.addToStatusArea('kerio-toggle', this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
