<?php

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
 *
 * =========================
 *
 * This script is used to manage the settings via the web interface
 *
 * HTTP GET query:
 *   When the header 'Accept' is 'application/json':
 *     It returns a list of the settings or data for the setting specified in the parameter name.
 *   otherwise:
 *     It returns the content of the index.html file.
 *
 * HTTP POST query:
 *   Updates data for specified setting. Data must be in json format with the following fields:
 *     `name`   string     Name of the setting.
 *     `action` string     Must be `update`.
 *     `value`  string|int Value to update.
 *   Example:
 *     { "name": "web.report-view.sort-records-by", "value": "ip", "action": "update" }
 *
 * Other HTTP methods:
 *   It returns an error.
 *
 * @category Web
 * @package  DmarcSrg
 * @author   Aleksey Andreev (liuch)
 * @license  https://www.gnu.org/licenses/gpl-3.0.html GNU/GPLv3
 */

namespace Liuch\DmarcSrg;

use Exception;
use Liuch\DmarcSrg\Settings\SettingsList;

require 'init.php';

if (Core::isJson()) {
    try {
        if (Core::method() == 'GET') {
            Core::auth()->isAllowed();

            if (isset($_GET['name'])) {
                Core::sendJson(SettingsList::getSettingByName($_GET['name'])->toArray());
                return;
            }

            $res = (new SettingsList())->getList();
            $list = array_map(function ($setting) {
                return $setting->toArray();
            }, $res['list']);

            Core::sendJson([
                'settings' => $list,
                'more'     => $res['more']
            ]);
            return;
        }
        if (Core::method() == 'POST' && Core::isJson()) {
            Core::auth()->isAllowed();
            $data = Core::getJsonData();
            if ($data) {
                $sett = SettingsList::getSettingByName($data['name'] ?? '');
                $action = $data['action'] ?? '';
                switch ($action) {
                    case 'update':
                        $sett->setValue($data['value']);
                        $sett->save();
                        Core::sendJson([
                            'error_code' => 0,
                            'message'    => 'Successfully updated'
                        ]);
                        break;
                    default:
                        throw new Exception('Bad request', -1);
                }
                return;
            }
        }
    } catch (Exception $e) {
        Core::sendJson(
            [
                'error_code' => $e->getCode(),
                'message'    => $e->getMessage()
            ]
        );
        return;
    }
    Core::sendBad();
    return;
}

Core::sendHtml();

