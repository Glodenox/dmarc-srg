/**
 * dmarc-srg - A php parser, viewer and summary report generator for incoming DMARC reports.
 * Copyright (C) 2020 Aleksey Andreev (liuch)
 *
 * Available at:
 * https://github.com/liuch/dmarc-srg
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of  MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along with
 * this program.  If not, see <http://www.gnu.org/licenses/>.
 */

class Admin {
	constructor(id) {
		this._state = null;
		this._element = null;
		this._sources = null;
		this._database = null;
	}

	display() {
		let cn = document.getElementById("main-block");
		if (!this._element) {
			this._element = document.createElement("div");
			this._element.setAttribute("class", "panel-container round-border");
			this._element.appendChild(this._get_database_elements());
			this._element.appendChild(this._get_sources_elements());
		}
		remove_all_children(cn);
		cn.appendChild(this._element);
	}

	update() {
		this._get_admin_state();
	}

	title() {
		return "Admin Panel";
	}

	_get_database_elements() {
		let fr = document.createDocumentFragment();
		let h = document.createElement("h4");
		h.appendChild(document.createTextNode("Database"));
		fr.appendChild(h);
		if (!this._database) {
			this._database = new DatabaseListBox(this._create_db_item_menu_element());
		}
		fr.appendChild(this._database.element());
		return fr;
	}

	_get_sources_elements() {
		let fr = document.createDocumentFragment();
		let h = document.createElement("h4");
		h.appendChild(document.createTextNode("Report sources"));
		fr.appendChild(h);
		if (!this._sources) {
			this._sources = new SourceListBox();
		}
		fr.appendChild(this._sources.element());
		return fr;
	}

	_get_admin_state() {
		[ this._database, this._sources ].forEach(function(c) {
			c.set_status("wait");
		});

		let t = this;
		window.fetch("admin.php", {
			method: "GET",
			cache: "no-store",
			headers: HTTP_HEADERS,
			credentials: "same-origin"
		}).then(function(resp) {
			if (resp.status !== 200)
				throw new Error("Failed to fetch the admin data");
			return resp.json();
		}).then(function(data) {
			if (data.error_code)
				throw new Error(data.message || "Failed");
			t._state = data;
			t._fill_data();
		}).catch(function(err) {
			console.warn(err.message);
			t._fill_data(err.message);
		});
	}

	_send_command(cmd) {
		let t = this;
		return window.fetch("admin.php", {
			method: "POST",
			cache: "no-store",
			headers: Object.assign(HTTP_HEADERS, HTTP_HEADERS_POST),
			credentials: "same-origin",
			body: JSON.stringify(cmd)
		}).then(function(resp) {
			if (resp.status !== 200)
				throw new Error("Failed");
			return resp.json();
		}).finally(function() {
			t._get_admin_state();
			Status.instance().update().catch(function(){});
		});
	}

	_fill_data(err_msg) {
		if (!err_msg) {
			this._database.set_data(this._state.database);
			this._sources.set_data(this._state.mailboxes);
		}
		else {
			this._database.set_status("error", err_msg);
			this._sources.set_status("error", err_msg);
		}
		if (this._state && this._state.database && this._state.database.needs_upgrade) {
			document.querySelector(".db-menu-button li[data-action=upgradedb]").classList.remove("hidden");
		}
	}

	_create_db_item_menu_element() {
		let el = document.createElement("div");
		let span = document.createElement("span");
		span.setAttribute("role", "button");
		span.appendChild(document.createTextNode("..."));
		el.appendChild(span);
		//
		let mn = document.createElement("div");
		mn.setAttribute("class", "db-item-menu popup-menu round-border hidden");
		let ul = document.createElement("ul");
		Admin.db_actions.forEach(function(it) {
			let li = document.createElement("li");
			li.setAttribute("data-action", it.action);
			li.setAttribute("data-title", it.title);
			li.setAttribute("title", it.long_title);
			let sp = document.createElement("span");
			sp.appendChild(document.createTextNode(it.name));
			li.appendChild(sp);
			ul.appendChild(li);
			if (it.action === "upgradedb")
				li.classList.add("hidden");
		}, this);
		mn.appendChild(ul);
		el.appendChild(mn);
		let t = this;
		el.addEventListener("click", function(event) {
			let it = event.target.closest("li");
			if (it || event.target.parentNode === this) {
				event.stopPropagation();
				this.querySelector(".popup-menu").classList.toggle("hidden");
			}
			if (it) {
				let action = it.getAttribute("data-action");
				let title  = it.getAttribute("data-title");
				t._do_db_action_password(action, title);
			}
		});
		return el;
	}

	_do_db_action_password(action, title) {
		let ld = new LoginDialog({
			nofetch: true,
			nousername: true
		});
		document.getElementById("main-block").appendChild(ld.element());
		let that = this;
		ld.show().then(function(d) {
			if (d) {
				that._do_db_action(action, title, { password: d.password });
			}
		}).catch(function(e) {
			console.error(e.message);
		}).finally(function() {
			ld.remove();
		});
	}

	_do_db_action(action, title, data) {
		let d = { cmd: action };
		if (data) {
			d = Object.assign(d, data);
		}
		this._send_command(d).then(function(data) {
			if (data.error_code && data.error_code !== 0)
				Notification.add({ text: title + ": " + (data.message || "Error!"), type: "error" });
			else
				Notification.add({ text: title + ": " + (data.message || "Completed successfully!"), type: "info" });
		}).catch(function(err) {
			Notification.add({ text: title + ": " + (err.message || "Error!"), type: "error" });
		});
	}
}

Admin.db_actions = [
	{
		name:       "Initiate",
		action:     "initdb",
		title:      "Intiate DB",
		long_title: "Create all needed tables and indexes in the database"
	},
	{
		name:       "Drop",
		action:     "droptables",
		title:      "Drop tables",
		long_title: "Drop all the tables from the database"
	},
	{
		name:       "Upgrade",
		action:     "upgradedb",
		title:      "Upgrade DB",
		long_title: "Update the structure of the database"
	}
];

class DropdownListBox {
	constructor() {
		this._items = [];
		this._element = null;
		this._root_content = null
		this._list_element = null;
	}

	element() {
		if (!this._element) {
			let el = document.createElement("div");
			//el.setAttribute("id", "mb-container");
			el.setAttribute("class", "round-border");
			let that = this;
			el.addEventListener("click", function(event) {
				if (event.target.closest(".root-list-block")) {
					if (that._items.length > 0) {
						that._list_element.classList.toggle("hidden");
						that._root_content.element().classList.toggle("bottom-border");
					}
				}
			});
			this._element = el;
			this._update_element();
		}
		return this._element;
	}

	set_status(type, message) {
		if (type === "wait") {
			set_wait_status(this.element());
		}
		else if (type === "error") {
			set_error_status(this.element(), message);
		}
	}

	set_data(data) {
		this._root_content = new ListBoxItem();
		this._make_root_columns(data);
		this._make_list_items(data);
		if (this._element) {
			this._update_element();
		}
	}

	_update_element() {
		if (this._element.children.length != 2) {
			remove_all_children(this._element);
			this._element.appendChild(this._content_container());
			this._element.appendChild(this._list_container());
		}
	}

	_content_container() {
		if (!this._root_content) {
			this._root_content = new ListBoxItem();
		}
		let c = this._root_content.element();
		let cl = [];
		for (let i = 0; i < c.classList.length; ++i) {
			if (c.classList[i].startsWith("state-"))
				cl.push(c.classList[i]);
		}
		c.setAttribute("class", "root-list-block" + (cl.length >0 && (" " + cl.join(" ")) || ""));
		return c;
	}

	_list_container() {
		let c = document.createElement("div");
		c.setAttribute("class", "list-container hidden");
		c.appendChild(this._make_list_item_elements());
		this._list_element = c;
		return c;
	}

	_make_root_columns(data) {
	}

	_make_list_items(data) {
		this._items = data.map(function(di) {
			let lbi = new ListBoxItem();
			return lbi;
		});
	}

	_make_list_item_elements() {
		let fr = document.createDocumentFragment();
		this._items.forEach(function(item) {
			fr.appendChild(item.element());
		});
		return fr;
	}
}

class DatabaseListBox extends DropdownListBox {
	constructor(menu) {
		super();
		this._menu = menu;
	}

	_make_root_columns(data) {
		this._root_content.state(data.correct && "green" || "red");
		this._root_content.add_column(new StatusIndicator(data.name, data.message, "title-item-wrap"));
		this._root_content.add_column(new ListBoxColumn(data.message, null, "message-item state-text"));
		this._root_content.add_column(new ListBoxColumn(data.type, null, "db-type"));
		this._root_content.add_column(new ListBoxColumn(data.location, null, "db-location"));
		if (this._menu)
			this._root_content.add_column(new ListBoxColumn(this._menu, null, "db-menu-button"));
	}

	_make_list_items(data) {
		super._make_list_items(data.tables);
		for (let i = 0; i < data.tables.length; ++i) {
			let d = data.tables[i];
			let it = this._items[i];
			let state = d.error_code && "red" || (d.message === "Ok" && "green" || "yellow");
			it.state(state);
			it.add_column(new StatusIndicator(d.name, d.message, "title-item-wrap"));
			it.add_column(new ListBoxColumn(d.engine || d.message, null, "message-item state-text"));
			it.add_column(new ListBoxColumn(d.rows || 0, "Records", "dbtable-records"));
			it.add_column(new ListBoxColumn((d.data_length || 0) + (d.index_length || 0), "Size", "dbtable-size"));
		}
	}

	_make_list_item_elements() {
		let fr = document.createDocumentFragment();
		let h = document.createElement("h5");
		h.appendChild(document.createTextNode("Tables (" + this._items.length + ")"));
		fr.appendChild(h);
		fr.appendChild(super._make_list_item_elements());
		return fr;
	}
}

class SourceListBox extends DropdownListBox {
	element() {
		let _new = !this._element && true || false;
		super.element();
		if (_new) {
			let that = this;
			this._element.addEventListener("click", function(event) {
				if (event.target.tagName == "BUTTON") {
					let p = event.target.closest("div[data-id]")
					if (p) {
						let id = parseInt(p.getAttribute("data-id"));
						let type = p.getAttribute("data-type");
						that._check_button_clicked(id, type, event.target);
					}
				}
			});
		}
		return this._element;
	}

	_make_root_columns(data) {
		let enabled = (data.length > 0);
		this._root_content.state(enabled && "green" || "gray");
		this._root_content.add_column(new StatusIndicator("Total sources: " + data.length, enabled && "Enabled" || "Disabled"));
	}

	_make_list_items(data) {
		this._items = data.map(function(di) {
			let lbi = new ListBoxItem();
			return lbi;
		});
	}

	_make_list_items(data) {
		this._items = data.map(function(di) {
			let it = new SourceListItem({ id: di.id, type: "mailbox" });
			it.state("green");
			it.add_column(new StatusIndicator(di.name, null, "title-item-wrap"));
			it.add_column(new ListBoxColumn(di.mailbox, null, "mailbox-location"));
			it.add_column(new ListBoxColumn(di.host, "Host", "mailbox-host"));
			it.add_column(new ListBoxColumn(this._get_check_button(), null, "source-check-button"));
			return it;
		}, this);
	}

	_make_list_item_elements() {
		let fr = document.createDocumentFragment();
		let h = document.createElement("h5");
		h.appendChild(document.createTextNode("Mailboxes (" + this._items.length + ")"));
		fr.appendChild(h);
		fr.appendChild(super._make_list_item_elements());
		return fr;
	}

	_get_check_button() {
		let btn = document.createElement("button");
		btn.appendChild(document.createTextNode("Check accessibility"));
		return btn;
	}

	_check_button_clicked(id, type, btn) {
		let that = this;
		let state = "yellow";
		let btn_text = btn.textContent;
		btn.textContent = "Checking...";
		btn.disabled = true;
		window.fetch("admin.php", {
			method: "POST",
			cache: "no-store",
			headers: Object.assign(HTTP_HEADERS, HTTP_HEADERS_POST),
			credentials: "same-origin",
			body: JSON.stringify({ cmd: "checksource", id: id, type: type })
		}).then(function(resp) {
			if (resp.status !== 200)
				throw new Error("Failed");
			return resp.json();
		}).then(function(data) {
			if (data.error_code)
				throw new Error(data.message || "Failed");
			let msg = [ data.message, "Messages: " + data.status.messages, "Unseen: " + data.status.unseen ];
			Notification.add({ text: msg, type: "info" });
			state = "green";
		}).catch(function(err) {
			console.warn(err.message);
			Notification.add({ text: err.message, type: "error" });
		}).finally(function() {
			btn.textContent = btn_text;
			btn.disabled = false;
			let item_f = false;
			let gstate = "green";
			for (let i = 0; i < that._items.length; ++i) {
				let it = that._items[i];
				if (!item_f && it.id() === id && it.type() === type) {
					it.state(state);
					item_f = true;
				}
				if (gstate === "green") {
					gstate = it.state();
				}
			}
			that._root_content.state(gstate);
		});
	}
}

class ListBoxItem {
	constructor() {
		this._state = null;
		this._element = null;
		this._columns = [];
	}

	add_column(col) {
		this._columns.push(col);
	}

	element() {
		if (!this._element) {
			this._element = document.createElement("div");
			let extra_class = "";
			if (this._state) {
				extra_class = " state-" + this._state;
			}
			this._element.setAttribute("class", "block-list-item round-border" + extra_class);
			this._insert_column_elements();
		}
		return this._element;
	}

	state(state) {
		if (!state) {
			return this._state;
		}

		if (this._element) {
			if (this._state) {
				this._element.classList.remove("state-" + this._state);
			}
			this._element.classList.add("state-" + state);
		}
		this._state = state;
	}

	_insert_column_elements() {
		this._columns.forEach(function(c) {
			this._element.appendChild(c.element());
		}, this);
	}
}

class SourceListItem extends ListBoxItem {
	constructor(data) {
		super();
		this._id = data.id;
		this._type = data.type;
	}

	id() {
		return this._id;
	}

	type() {
		return this._type;
	}

	element() {
		let el = super.element();
		el.setAttribute("data-id", this._id);
		el.setAttribute("data-type", this._type);
		return el;
	}
}

class ListBoxColumn {
	constructor(value, title, class_string) {
		this._value = value;
		this._title = title;
		this._class = class_string;
		this._element = null;
	}

	element() {
		if (!this._element) {
			this._element = document.createElement("div");
			this._element.setAttribute("class", "block-item-column" + (this._class && (" " + this._class) || ""));
			this._add_children();
		}
		return this._element;
	}

	_add_children() {
		let val_el = this._element;
		if (this._title) {
			let sp = document.createElement("span");
			sp.appendChild(document.createTextNode(this._title + ":"));
			this._element.appendChild(sp);
			val_el = document.createElement("span");
			val_el.setAttribute("class", "value");
			this._element.appendChild(val_el);
		}
		if (typeof(this._value) != "object")
			val_el.appendChild(document.createTextNode(this._value));
		else
			val_el.appendChild(this._value);
	}
}

class StatusIndicator extends ListBoxColumn {
	_add_children() {
		let div = document.createElement("div");
		div.setAttribute("class", "state-background status-indicator");
		if (this._title) {
			div.setAttribute("title", this._title);
		}
		this._element.appendChild(div);
		if (this._value) {
			div = document.createElement("div");
			div.appendChild(document.createTextNode(this._value));
			this._element.appendChild(div);
		}
	}
}

