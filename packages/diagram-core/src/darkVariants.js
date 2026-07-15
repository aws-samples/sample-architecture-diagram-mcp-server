// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// Base names (without ".png") of flat diagram icons that ship an official
// "<name>_Dark.png" white-glyph sibling under the icon library. These are dark
// line-art / solid tiles that vanish on a dark background and can't be fixed by
// a brightness/invert filter, so a renderer swaps to the *_Dark asset in dark
// mode instead of filtering. Keep in sync with the served assets:
//   ls <icons>/*_Dark.png | xargs -n1 basename | sed 's/_Dark\.png//'
export const DARK_VARIANT_BASES = new Set([
  "AWS-Cloud_32", "AWS-Cloud-logo_32",
  "Res_Alert_48", "Res_Authenticated-User_48", "Res_AWS-Management-Console_48",
  "Res_Camera_48", "Res_Chat_48", "Res_Client_48", "Res_Cold-Storage_48",
  "Res_Credentials_48", "Res_Data-Stream_48", "Res_Data-Table_48", "Res_Database_48",
  "Res_Disk_48", "Res_Document_48", "Res_Documents_48", "Res_Email_48",
  "Res_Firewall_48", "Res_Folder_48", "Res_Folders_48", "Res_Forums_48",
  "Res_Gear_48", "Res_Generic-Application_48", "Res_Git-Repository_48", "Res_Globe_48",
  "Res_Internet_48", "Res_Internet-alt1_48", "Res_Internet-alt2_48", "Res_JSON-Script_48",
  "Res_Logs_48", "Res_Magnifying-Glass_48", "Res_Metrics_48", "Res_Mobile-client_48",
  "Res_Multimedia_48", "Res_Office-building_48", "Res_Programming-Language_48",
  "Res_Question_48", "Res_Recover_48", "Res_SAML-token_48", "Res_SDK_48",
  "Res_Server_48", "Res_Servers_48", "Res_Shield_48", "Res_Source-Code_48",
  "Res_SSL-padlock_48", "Res_Tape-storage_48", "Res_Toolkit_48",
  "Res_Users_48",
  // NOTE: 'Res_User_48' is intentionally excluded — AWS shipped a *_Dark that is
  // a DIFFERENT glyph (single person vs the two-person light art), so swapping
  // would change the icon on theme toggle. It falls through to the CSS invert
  // filter instead, which keeps the same glyph and only recolors it.
]);
