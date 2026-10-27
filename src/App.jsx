import { cloneElement, createContext, isValidElement, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, CalendarDays, ChevronDown, CircleDollarSign, ClipboardList,
  Edit2, LogOut, Menu, Package, Plus, ReceiptText, Search,
  Trash2, Users, Wallet, X, Boxes, LayoutGrid, ShoppingCart, RotateCcw,
  RefreshCw, Grid2X2, List, Eye, Copy,
  FileText, UserRound, CircleUserRound, Building2, Settings, LockKeyhole, Pencil, Sun, Moon,
} from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import api, { API_BASE_URL } from './services/api'
import { clearPrivateData, getOfflineAccount, rememberOfflineAccount, verifyOfflinePin, offlineDb, cacheSalesHistory, cacheApiData, getCachedApiData } from './offline/db'
import { OfflineSyncProvider, OfflineSyncStatus } from './offline/OfflineSyncProvider'
import { useOfflineSync } from './offline/OfflineSyncContext'
import './App.css'

const money = (value) => new Intl.NumberFormat('en-US').format(Number(value || 0))
const cashInFor = (row) => Number(row?.cashIn ?? (Number(row?.paidAmount || 0) - Number(row?.cashOut || 0)))
const today = new Date().toISOString().slice(0, 10)
const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
const liveRefreshMs = 10 * 60 * 1000
let deferredPwaInstallPrompt = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    deferredPwaInstallPrompt = event
    window.dispatchEvent(new Event('manageyourstockinstallavailable'))
  })
  window.addEventListener('appinstalled', () => { deferredPwaInstallPrompt = null })
}
const PreferencesContext = createContext({ language: 'en', theme: 'light', mode: 'online', setLanguage: () => {}, setTheme: () => {}, setMode: () => {}, t: (text) => text })
const translations = {
  rw: {
    Dashboard: 'Imbonerahamwe', STOCK: 'UBUBIKO', 'All Products': 'Ibicuruzwa byose', 'Sold Products': 'Ibicuruzwa byagurishijwe', Reports: 'Raporo', 'Record Sale': 'Andika igurisha', 'Add Product': 'Ongeramo igicuruzwa', ACCOUNT: 'KONTI', 'Account Information': 'Amakuru ya konti', 'Manage Branches': 'Genzura amashami', Users: 'Abakoresha', Settings: 'Igenamiterere', Logout: 'Sohoka', Overview: 'Incamake', Products: 'Ibicuruzwa', 'Add New Product': 'Ongeramo igicuruzwa gishya', Transactions: 'Ibikorwa', 'Record Product Sale': 'Andika igicuruzwa cyagurishijwe', 'Users management': 'Imicungire y’abakoresha', 'Review workspace preferences.': 'Reba igenamiterere ry’aho mukorera.', Currency: 'Ifaranga', Workspace: 'Ahakorerwa', 'Shop settings': 'Igenamiterere ry’iduka', Language: 'Ururimi', Appearance: 'Imigaragarire', Light: 'Umucyo', Dark: 'Umwijima', English: 'Icyongereza', Kinyarwanda: 'Ikinyarwanda',
    'BUSINESS WORKSPACE': 'AHO UBUCURUZI BUKORERA', 'Search products... (Ctrl+K)': 'Shakisha ibicuruzwa... (Ctrl+K)', 'Ctrl K': 'Ctrl K', 'From date': 'Guhera ku itariki', 'To date': 'Kugeza ku itariki', 'This month': 'Uku kwezi', Search: 'Shakisha', 'Loading records...': 'Birimo gupakurura inyandiko...', 'No records found.': 'Nta nyandiko zabonetse.', Date: 'Itariki', User: 'Umukoresha', 'Product name': 'Izina ry’igicuruzwa', Amount: 'Amafaranga', 'Cash Out': 'Amafaranga yasohotse', 'Cash In': 'Amafaranga yinjiye', Rest: 'Asigaye', Method: 'Uburyo', Description: 'Ibisobanuro', Today: 'Uyu munsi', Me: 'Jyewe', Optional: 'Si ngombwa', Saving: 'Birimo kubikwa...', Save: 'Bika', Cancel: 'Kureka', Total: 'Igiteranyo', 'MoMo Pay': 'MoMo Pay', Cash: 'Amafaranga', 'Are you sure you want to delete this row?': 'Urashaka koko gusiba iyi nyandiko?',
    Amount: 'Amafaranga', 'Cash Out': 'Amafaranga yasohotse', 'Cash In': 'Amafaranga yinjiye', 'Amount rest': 'Amafaranga asigaye', Transactions: 'Ibikorwa', 'Imported stock': 'Ibicuruzwa byinjijwe mu bubiko', 'Customer payments': 'Amafaranga y’abakiriya', 'Service/product costs': 'Ikiguzi cya serivisi/ibicuruzwa', 'Amount minus Cash Out': 'Amafaranga asigaye nyuma yo gukuramo ayasohotse', 'Remaining money': 'Amafaranga asigaye', 'Selected period': 'Igihe cyatoranyijwe', 'Recent transactions': 'Ibikorwa biheruka', 'Latest sales activity': 'Ibyagurishijwe vuba', 'Payment summary': 'Incamake y’ubwishyu', 'Low stock products': 'Ibicuruzwa biri hafi gushira', 'Products at or below their alert level': 'Ibicuruzwa biri ku mubare w’impuruza cyangwa munsi yawo', 'Recent imported stock': 'Ibicuruzwa biheruka kwinjizwa', 'Latest inventory purchases by all users': 'Ibicuruzwa biheruka kugurwa n’abakoresha bose', 'Quick actions': 'Ibikorwa byihuse', 'Work faster': 'Kora vuba', 'New transaction': 'Igikorwa gishya', 'New product': 'Igicuruzwa gishya', 'View reports': 'Reba raporo', 'View all': 'Reba byose',
    Management: 'Imicungire', MANAGEMENT: 'IMICUNGIRE', Reporting: 'Raporo', REPORTING: 'RAPORO', 'Daily reports': 'Raporo za buri munsi', 'Totals update automatically from saved transactions.': 'Ibyegeranyo bivugururwa byikora hashingiwe ku bikorwa byabitswe.', 'Download report': 'Manura raporo', 'Total amount': 'Amafaranga yose', 'Total Cash Out': 'Amafaranga yose yasohotse', 'Total Cash In': 'Amafaranga yose yinjiye', 'Total remaining money': 'Amafaranga yose asigaye', 'Cash received': 'Amafaranga yakiriwe', 'MoMo Pay received': 'Amafaranga yakiriwe kuri MoMo', 'Current stock value': 'Agaciro k’ibiri mu bubiko', 'Best-selling products': 'Ibicuruzwa byagurishijwe cyane', 'Ranked by quantity sold in the selected period': 'Bishyizwe ku rutonde hakurikijwe ingano yagurishijwe mu gihe cyatoranyijwe', Product: 'Igicuruzwa', SKU: 'Kode ya SKU', 'Quantity sold': 'Umubare wagurishijwe', Sales: 'Ibyagurishijwe', 'No product sales for this period.': 'Nta bicuruzwa byagurishijwe muri iki gihe.', 'Sales report': 'Raporo y’ibyagurishijwe', 'Transactions for the selected device date': 'Ibikorwa byo ku matariki yatoranyijwe', 'Add row': 'Ongeraho umurongo',
    'Record and review customer sales.': 'Andika kandi urebe ibyagurishijwe ku bakiriya.', 'Record sale': 'Andika igurisha', 'All transactions': 'Ibikorwa byose', 'Showing records from your selected period': 'Herekanywe inyandiko zo mu gihe wahisemo', 'Search by product, category, SKU, model...': 'Shakisha igicuruzwa, icyiciro, SKU cyangwa model...', 'All Branches': 'Amashami yose', 'All Categories': 'Ibyiciro byose', 'All Status': 'Imiterere yose', 'Loading sold products...': 'Birimo gupakurura ibyagurishijwe...', 'No sold products found.': 'Nta bicuruzwa byagurishijwe byabonetse.', 'Main Store': 'Ububiko bukuru', Quantity: 'Umubare', 'Unit Price': 'Igiciro kimwe', 'Purchase Cost': 'Ikiguzi cyo kugura', 'Total Revenue': 'Amafaranga yose yinjiye', 'Profits: ': 'Inyungu: ', 'Customer: ': 'Umukiriya: ', 'Delete sale and restore stock': 'Siba igurisha kandi usubize ibicuruzwa mu bubiko', 'Showing ': 'Herekanywe ', ' to ': ' kugeza ', ' of ': ' muri ', ' sales records': ' inyandiko z’igurisha', 'Previous': 'Ibanjirije', Next: 'Ikurikira',
    'Customer (Name, Phone, or TIN Number)': 'Umukiriya (Amazina, telefone cyangwa TIN)', 'Payment Type': 'Uburyo bwo kwishyura', 'Fill in customer and payment type, add items to list, and click Record Sale.': 'Andika umukiriya n’uburyo bwo kwishyura, wongere ibicuruzwa ku rutonde, ukande Andika igurisha.', 'View All Sold Products': 'Reba ibicuruzwa byose byagurishijwe', 'Sale item list': 'Urutonde rw’ibicuruzwa bigurishwa', ' Item Line(s)': ' umurongo w’igicuruzwa', 'Item name': 'Izina ry’igicuruzwa', Package: 'Gipaki', 'No matching products.': 'Nta bicuruzwa bihuye n’ishakisha.', 'Only ': 'Hafi ', ' in stock.': ' biri mu bubiko.', 'In stock: ': 'Mu bubiko: ', 'Record Sale': 'Andika igurisha', 'Recently Sold Products Data': 'Amakuru y’ibicuruzwa biheruka kugurishwa', Refresh: 'Ongera uvugurure', Payment: 'Ubwishyu',
    'Register New Stock Product': 'Andika igicuruzwa gishya mu bubiko', 'Fill in product details to register new inventory stock.': 'Uzuza amakuru y’igicuruzwa kugira ngo ukibike mu bubiko.', 'Back to Products': 'Subira ku bicuruzwa', 'PRODUCT INFORMATION': 'AMAKURU Y’IGICURUZWA', 'SKU / Product code': 'SKU / Kode y’igicuruzwa', 'Optional unique code': 'Kode yihariye (si ngombwa)', Category: 'Icyiciro', Brand: 'Ikirango', Model: 'Model', 'STOCK AND PRICING': 'UBUBIKO N’IBICIRO', Unit: 'Igipimo', 'Purchase price (per unit)': 'Igiciro cyo kugura (kimwe)', 'Selling price (per unit)': 'Igiciro cyo kugurisha (kimwe)', 'This price is for all items combined (total cost)': 'Iki ni igiciro cy’ibicuruzwa byose hamwe', 'STORAGE AND SUPPLIER': 'AHO BIBIKWA N’UMUTANGA', 'Branch / storage location': 'Ishami / aho bibikwa', 'Supplier (name or phone number)': 'Umutanga (izina cyangwa telefone)', 'Shown when this product is chosen during a sale.': 'Bigaragara igihe iki gicuruzwa gihiswemo mu igurisha.', 'Cancel / Back': 'Kureka / Subira inyuma', 'Record New Product': 'Bika igicuruzwa gishya', 'Total Items': 'Ibintu byose', 'unique products': 'ibicuruzwa byihariye', Refresh: 'Ongera uvugurure', 'Record Sale': 'Andika igurisha', 'All Brands': 'Ibirango byose', 'All Statuses': 'Imiterere yose', 'Sort: Latest Added': 'Shungura: ibyongerewe vuba', 'Sort: Oldest Added': 'Shungura: ibyongerewe kera', 'Sort: Product Name': 'Shungura: izina ry’igicuruzwa', 'Out of Stock': 'Byashize mu bubiko', 'Low Stock': 'Bike mu bubiko', 'In Stock': 'Birahari mu bubiko', Inactive: 'Bidakora', Active: 'Birakora', Confirm: 'Emeza', Unconfirm: 'Kuraho iyemeza', Confirmed: 'Byemejwe', Yes: 'Yego', 'Price on Sale': 'Igiciro cyo kugurisha', 'Total Value': 'Agaciro kose', Edit: 'Hindura', Duplicate: 'Koporora', 'No products found.': 'Nta bicuruzwa byabonetse.', ' per page': ' kuri paji', Previous: 'Ibanjirije', 'Showing ': 'Herekanywe ', ' to ': ' kugeza ', ' of ': ' muri ', ' products': ' ibicuruzwa',
    'Imported stock by selected date.': 'Ibicuruzwa byinjijwe ku itariki yatoranyijwe.', 'Username, phone number, and PIN only.': 'Izina ry’ukoresha, telefone na PIN gusa.', 'Edit user': 'Hindura umukoresha', 'Add user': 'Ongeraho umukoresha', Username: 'Izina ry’ukoresha', 'Phone number': 'Nimero ya telefone', PIN: 'PIN', 'Cancel edit': 'Kureka guhindura', 'All ': 'Byose ', 'Inventory purchases': 'Ibyaguzwe byo mu bubiko', 'Live records from MongoDB': 'Inyandiko ziri muri MongoDB', 'Imported stock saved.': 'Ibicuruzwa byinjijwe byabitswe.', 'Imported stock updated.': 'Ibicuruzwa byinjijwe bivuguruwe.', 'Saved successfully.': 'Byabitswe neza.', 'Created successfully.': 'Byaremwe neza.', 'Deleted successfully.': 'Byasibwe neza.', 'Unlinked import': 'Ibyinjijwe bitahujwe n’igicuruzwa', 'What imported': 'Ibyinjijwe', 'Payment method': 'Uburyo bwo kwishyura', 'No products are currently low on stock.': 'Nta bicuruzwa biri hafi gushira.', 'Low Stock · ': 'Bike mu bubiko · ',
    'Review team activity across the system.': 'Reba ibikorwa by’itsinda muri sisitemu.', 'Manage ': 'Genzura ', ' from the live database.': ' muri data base.', 'Branch management': 'Imicungire y’amashami', 'Branch management is not configured for this workspace yet.': 'Imicungire y’amashami ntirashyirwa muri iyi sisitemu.', 'Account Information': 'Amakuru ya konti', 'View and update your profile details and settings.': 'Reba kandi uvugurure amakuru ya konti n’igenamiterere.', AVATAR: 'IFOTO', 'FIRST NAME': 'IZINA', 'LAST NAME': 'IZINA RY’UMURYANGO', GENDER: 'IGITSINA', EMAIL: 'IMELI', PHONE: 'TELEFONE', ROLE: 'URUHARE', 'Change Password': 'Hindura ijambo ry’ibanga', 'CURRENT PASSWORD': 'IJAMBO RY’IBANGA RYA KERA', 'NEW PASSWORD': 'IJAMBO RY’IBANGA RISHYA', 'CONFIRM NEW PASSWORD': 'SUBIRAMO IJAMBO RY’IBANGA RISHYA', 'Enter current password': 'Andika ijambo ry’ibanga rya kera', 'Enter new password': 'Andika ijambo ry’ibanga rishya', 'Confirm new password': 'Emeza ijambo ry’ibanga rishya', 'Update password': 'Vugurura ijambo ry’ibanga', 'Current workspace preferences': 'Igenamiterere ry’aho mukorera', 'Settings': 'Igenamiterere', 'Review workspace preferences.': 'Reba igenamiterere ry’aho mukorera.', Currency: 'Ifaranga', Workspace: 'Ahakorerwa', 'Shop settings': 'Igenamiterere ry’iduka', Language: 'Ururimi', Appearance: 'Imigaragarire', Light: 'Umucyo', Dark: 'Umwijima', English: 'Icyongereza', Kinyarwanda: 'Ikinyarwanda',
    'Sign in': 'Injira', 'Enter your phone number and PIN.': 'Andika nimero ya telefone na PIN yawe.', 'Sign in securely': 'Injira mu buryo bwizewe', 'Signing in...': 'Birimo kwinjira...', 'Cannot reach the server at ': 'Ntibishobotse kugera kuri seriveri kuri ', '. Check the API URL and server connection, then try again.': '. Reba API URL n’ihuza rya seriveri, wongere ugerageze.', 'Something went wrong': 'Habaye ikibazo', 'Loading products...': 'Birimo gupakurura ibicuruzwa...', 'No product sales for this period.': 'Nta bicuruzwa byagurishijwe muri iki gihe.', 'No records found.': 'Nta nyandiko zabonetse.', 'No matching products.': 'Nta bicuruzwa bihuye n’ishakisha.', 'All transactions': 'Ibikorwa byose', 'Search products...': 'Shakisha ibicuruzwa...', 'Search by product, category, SKU, model...': 'Shakisha igicuruzwa, icyiciro, SKU cyangwa model...'
  },
}

Object.assign(translations.rw, {
  'Head office · branch overview': 'Incamake y’ibiro bikuru n’amashami', 'Monitor users, inventory, and sales across your branches.': 'Kurikirana abakoresha, ububiko n’igurisha mu mashami yawe.', 'Total branches': 'Amashami yose', 'Active users': 'Abakoresha bakora', 'Active today': 'Abakoresheje uyu munsi', 'Active branches': 'Amashami akora', 'Low stock alerts': 'Imiburo y’ububiko buke', 'Branch Manager': 'Umuyobozi w’ishami', 'Full name': 'Amazina yuzuye', 'Initial PIN': 'PIN yo gutangira', 'Reset PIN (optional)': 'Hindura PIN (si ngombwa)', 'Account status': 'Imiterere ya konti', 'Select branch': 'Hitamo ishami', 'Unassigned': 'Nta shami yashyizweho',
  'Operating mode': 'Uburyo sisitemu ikoramo', 'Online mode': 'Uburyo bwo kuri interineti', 'Offline mode': 'Uburyo bwo hanze ya interineti',
  'Offline mode uses saved data. Sales and stock imports queue for sync; other records are view-only.': 'Uburyo bwo hanze ya interineti bukoresha amakuru yabitswe. Ibyagurishijwe n’ibyinjijwe mu bubiko bitegereza guhuza; andi makuru arebwa gusa.',
  'Online mode uses live server data and synchronizes queued offline sales and imports.': 'Uburyo bwo kuri interineti bukoresha amakuru mashya ya seriveri kandi bugahuza ibyagurishijwe n’ibyinjijwe byari bitegereje.',
  'Offline mode is read-only for this action. Sales and stock imports can still be queued.': 'Ubu buryo ntibwemerera guhindura aya makuru. Ibyagurishijwe n’ibyinjijwe mu bubiko biracyabikwa ngo bihuzwe.',
  'Install app': 'Shyiramo porogaramu', 'Uninstall app': 'Kuramo porogaramu', 'Install manageyourstock on this device': 'Shyira manageyourstock kuri iki gikoresho', 'App installed': 'Porogaramu yashyizwemo',
  'Use your browser’s install option to add the app to this device.': 'Koresha uburyo bwo gushyiramo porogaramu buri muri mucukumbuzi yawe.',
  'Your device controls app removal. On Windows, open Start, find manageyourstock, right-click it, and choose Uninstall. On Android, long-press its icon and choose App info, then Uninstall. On iPhone or iPad, touch and hold its icon, then choose Remove App.': 'Igikoresho cyawe ni cyo kiyobora ikurwaho rya porogaramu. Kuri Windows, fungura Start, ushake manageyourstock, ukandeho iburyo uhitemo Uninstall. Kuri Android, kanda igihe kirekire ku kimenyetso cyayo, uhitemo App info hanyuma Uninstall. Kuri iPhone cyangwa iPad, kanda igihe kirekire ku kimenyetso cyayo uhitemo Remove App.',
  'On iPhone or iPad, open the browser Share menu and choose Add to Home Screen. On other devices, use the browser menu and choose Install app or Add to Home Screen.': 'Kuri iPhone cyangwa iPad, fungura Share muri mucukumbuzi uhitemo Add to Home Screen. Ku bindi bikoresho, koresha menu ya mucukumbuzi uhitemo Install app cyangwa Add to Home Screen.',
  Close: 'Funga', 'App installation status': 'Imiterere yo gushyiramo porogaramu',
  Online: 'Ifite interineti', Offline: 'Nta interineti', 'Last sync': 'Igihe iheruka guhuza', 'Not synced yet': 'Ntiyigeze ihuzwa', pending: 'bitegereje', conflicts: 'ibibazo',
  'Saved on this device for 90 days.': 'Bibikwa kuri iki gikoresho mu gihe cy’iminsi 90.',
  'The browser may clear locally stored records': 'Mucukumbuzi ishobora gusiba amakuru yabitswe kuri iki gikoresho', 'Local storage not persistent': 'Amakuru yo kuri iki gikoresho ashobora gusibangana',
  'Syncing…': 'Birimo guhuza…', 'Sync now': 'Huza ubu', 'Hide queue': 'Hisha urutonde', 'View queue': 'Reba urutonde',
  'Enter your PIN to sign in and sync': 'Andika PIN yawe kugira ngo winjire uhuze amakuru', 'Sign in and sync': 'Injira uhuze amakuru',
  Sale: 'Igurisha', 'Stock import': 'Ibyinjijwe mu bubiko', 'Waiting to sync': 'Bitegereje guhuza', 'Needs attention': 'Bisaba kugenzurwa', Retry: 'Ongera ugerageze', Discard: 'Kuraho',
  'Sync status': 'Imiterere yo guhuza', Pending: 'Bitegereje', Conflict: 'Ikibazo', Synced: 'Byahujwe',
  category: 'icyiciro', brand: 'ikirango', model: 'model', unit: 'igipimo',
  'All Payment Types': 'Ubwoko bwose bw’ubwishyu', Retry: 'Ongera ugerageze',
  'Could not load products. Check your connection and try again.': 'Ntibyashobotse gupakurura ibicuruzwa. Reba ihuza wongere ugerageze.',
  'No active products are available. Add a product before recording a sale.': 'Nta bicuruzwa bikora bihari. Banza wongere igicuruzwa mbere yo kwandika igurisha.',
  'BUSINESS OVERVIEW': 'INSHAMAKE Y’UBUCURUZI', 'Stock and sales at a glance': 'Incamake y’ububiko n’ibyagurishijwe',
  'Monitor cash flow, inventory levels, and recent activity.': 'Kurikirana amafaranga, urwego rw’ububiko n’ibikorwa biheruka.',
  'Refresh dashboard': 'Vugurura incamake', 'Payments received': 'Amafaranga yakiriwe', 'Cash out': 'Amafaranga yasohotse',
  'Net cash': 'Amafaranga asigaye', 'Outstanding balance': 'Umwenda usigaye', 'Sales recorded': 'Ibyagurishijwe byanditswe',
  'Units in stock': 'Ibicuruzwa biri mu bubiko', 'Current stock value': 'Agaciro k’ibiri mu bubiko',
  'Low / out of stock': 'Ibiri hafi gushira / ibyashize', 'Customer payments during selected period': 'Amafaranga y’abakiriya mu gihe cyatoranyijwe',
  'Recorded expenses against sales': 'Amafaranga yasohotse ajyanye n’ibyagurishijwe', 'Payments received after cash out': 'Amafaranga asigaye nyuma y’ayavuyeho',
  'Remaining customer balance': 'Amafaranga abakiriya basigaje kwishyura', 'During selected period': 'Mu gihe cyatoranyijwe',
  'Quantity multiplied by cost price': 'Umubare wikubye n’igiciro cyo kugura', 'active products': 'ibicuruzwa bikora',
  Select: 'Hitamo', Category: 'Icyiciro', Brand: 'Ikirango', Model: 'Model', Unit: 'Igipimo',
  'Product name': 'Izina ry’igicuruzwa', 'Selling price': 'Igiciro cyo kugurisha',
  'Cost price': 'Igiciro cyo kugura', 'Quantity in stock': 'Umubare uri mu bubiko', 'Low stock alert level': 'Umubare w’impuruza y’ibicuruzwa bike',
  'Storage location': 'Aho kibitswe', Supplier: 'Umutanga', Status: 'Imiterere', Notes: 'Ibisobanuro', 'Model / description': 'Model / ibisobanuro',
  'SKU / product code': 'SKU / kode y’igicuruzwa', 'Add product': 'Ongeramo igicuruzwa', 'Edit product': 'Hindura igicuruzwa',
  'Search products or SKU...': 'Shakisha ibicuruzwa cyangwa SKU...', 'All locations': 'Ahantu hose', 'All stock levels': 'Imibare yose y’ububiko',
  'All statuses': 'Imiterere yose', 'No products found.': 'Nta bicuruzwa byabonetse.', 'Select category': 'Hitamo icyiciro',
  'Select brand': 'Hitamo ikirango', 'Select model': 'Hitamo model', '+ Add new': '+ Ongeraho gishya', 'Product added.': 'Igicuruzwa cyongeweho.',
  'Product updated.': 'Igicuruzwa cyavuguruwe.', 'Product deleted.': 'Igicuruzwa cyasibwe.', 'Enter new category': 'Andika icyiciro gishya',
  'Enter new brand': 'Andika ikirango gishya', 'Enter new model': 'Andika model nshya', 'Enter new location': 'Andika aho gishya kibikwa',
  'Sale item list': 'Urutonde rw’ibicuruzwa bigurishwa', 'Item name': 'Izina ry’igicuruzwa', 'Payment Type': 'Uburyo bwo kwishyura',
  'Search product by name, code, brand...': 'Shakisha igicuruzwa ukoresheje izina, kode cyangwa ikirango...',
  'No matching products.': 'Nta bicuruzwa bihuye n’ishakisha.', 'Current stock': 'Umubare uri mu bubiko', 'Available quantity': 'Umubare uhari',
  'Only ': 'Hafi ', ' in stock.': ' biri mu bubiko.', 'In stock: ': 'Mu bubiko: ',
  'Out of Stock': 'Byashize mu bubiko', 'Low Stock': 'Bike mu bubiko', 'In Stock': 'Birahari mu bubiko',
  'Product Name': 'Izina ry’igicuruzwa', Customer: 'Umukiriya', Code: 'Kode', Qty: 'Umubare', Profits: 'Inyungu', Payment: 'Ubwishyu',
  'Mobile Money': 'Amafaranga kuri telefone', Card: 'Ikarita', Bank: 'Banki', Other: 'Ubundi', General: 'Rusange', Remove: 'Kuraho',
  'Recording...': 'Birimo kwandika...', 'Record Sale': 'Andika igurisha', 'Total Revenue:': 'Amafaranga yose yinjiye:',
  'Total Profits:': 'Inyungu zose:', 'Recently Sold Products Data': 'Amakuru y’ibicuruzwa biheruka kugurishwa',
  'Download report': 'Manura raporo', 'Add row': 'Ongeraho umurongo', 'Imported item': 'Igicuruzwa cyinjijwe',
  'Unlinked import': 'Ibyinjijwe bitahujwe n’igicuruzwa', 'What imported': 'Ibyinjijwe', 'Payment method': 'Uburyo bwo kwishyura',
  'Enter 4-digit PIN': 'Andika PIN y’imibare 4', 'Phone number': 'Nimero ya telefone', PIN: 'PIN',
  'This field is required.': 'Iki gice ni ngombwa.', 'SKU already exists.': 'Iyi SKU isanzwe ikoreshwa.',
  'Product not found.': 'Igicuruzwa ntikibashije kuboneka.', 'Insufficient stock.': 'Ibicuruzwa biri mu bubiko ntibihagije.',
  'Network Error': 'Ikibazo cy’ihuza rya interineti', 'Invalid credentials': 'Amakuru yo kwinjira si yo',
  Branch: 'Ishami',
  'Branch management': 'Imicungire y’amashami', 'Create branches and review each branch’s stock, sales, and imports.': 'Kora amashami kandi urebe ububiko, ibyagurishijwe n’ibyinjijwe muri buri shami.', 'Add branch': 'Ongeraho ishami', 'Edit branch': 'Hindura ishami', 'Branch records keep inventory and activity organized by location.': 'Amakuru y’ishami atunganya ububiko n’ibikorwa hakurikijwe aho biri.', 'Branch name *': 'Izina ry’ishami *', 'Branch code': 'Kode y’ishami', Address: 'Aderesi', Phone: 'Telefone', 'Branch manager': 'Umuyobozi w’ishami', 'Save branch': 'Bika ishami', 'Loading branches...': 'Birimo gupakurura amashami...', 'View branch': 'Reba ishami', Activate: 'Kora', Deactivate: 'Hagarika', Products: 'Ibicuruzwa', 'Stock units': 'Umubare uri mu bubiko', 'Stock value': 'Agaciro k’ububiko', 'Low stock': 'Ububiko buke', 'Sales records': 'Inyandiko z’igurisha', 'Products in this branch': 'Ibicuruzwa biri muri iri shami', 'Recent sales': 'Ibyagurishijwe biheruka', 'Recent imports': 'Ibyinjijwe biheruka', 'No branches found. Run the database migration to add the default branch, or add a branch.': 'Nta mashami ahari. Koresha migration ya data base kugira ngo wongere ishami risanzwe, cyangwa wongere irishya.', 'No products assigned to this branch.': 'Nta bicuruzwa byashyizwe muri iri shami.', 'No sales in this branch yet.': 'Nta byagurishijwe biraba muri iri shami.', 'No imports in this branch yet.': 'Nta byinjijwe biraba muri iri shami.', 'This branch still has products. Set it inactive to preserve its history.': 'Iri shami riracyafite ibicuruzwa. Rihagarike kugira ngo amateka yabyo agumane.', 'Select branch': 'Hitamo ishami', 'All Branches': 'Amashami yose',
})

function localizeNode(node, t) {
  if (Array.isArray(node)) return node.map((child) => localizeNode(child, t))
  if (typeof node === 'string') {
    const leading = node.match(/^\s*/)?.[0] || ''
    const trailing = node.match(/\s*$/)?.[0] || ''
    const trimmed = node.trim()
    return trimmed ? `${leading}${t(trimmed)}${trailing}` : node
  }
  if (!isValidElement(node)) return node
  const props = {}
  Object.entries(node.props).forEach(([key, value]) => {
    if (key === 'children') props.children = localizeNode(value, t)
    else if (typeof value === 'string' && ['label', 'placeholder', 'title', 'aria-label', 'alt', 'text', 'actionText'].includes(key)) props[key] = t(value)
    else props[key] = value
  })
  return cloneElement(node, props)
}
const isAdmin = (user) => ['ADMIN', 'OWNER'].includes(user?.role)
const isManager = (user) => user?.role === 'MANAGER'
const canManageBusiness = (user) => isAdmin(user) || isManager(user)
const canManageAdmin = (user) => isAdmin(user)
const idOf = (value) => String(value?._id || value?.id || value || '')
const isOwnTransaction = (row, user) => {
  const userId = idOf(user)
  return userId && [row?.createdBy, row?.staff].some((owner) => idOf(owner) === userId)
}
const isOwnRow = (row, user) => idOf(user) && idOf(row?.createdBy) === idOf(user)

const emptyTransaction = {
  productId: '', quantity: 1, unitPrice: '',
  productName: '',
  paidAmount: '',
  cashOut: '',
  remainingAmount: '',
  paymentMethod: 'CASH',
  description: '',
}

const emptyStock = {
  description: '',
  amount: '',
  productId: '', stockQuantity: '',
  paymentMethod: 'CASH',
}

function useAuth() {
  const [user, setUser] = useState(() => {
    try {
      if (!sessionStorage.getItem('shop_report_token')) {
        sessionStorage.removeItem('shop_report_user')
        return null
      }
      const saved = sessionStorage.getItem('shop_report_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      sessionStorage.removeItem('shop_report_user')
      sessionStorage.removeItem('shop_report_token')
      return null
    }
  })
  const [lockedAccount, setLockedAccount] = useState(null)
  const [showOnlineLogin, setShowOnlineLogin] = useState(false)
  const [offline, setOffline] = useState(false)
  const [offlinePin, setOfflinePin] = useState('')

  useEffect(() => {
    if (showOnlineLogin || sessionStorage.getItem('shop_report_token')) return undefined
    let alive = true
    getOfflineAccount().then((account) => {
      if (!alive || sessionStorage.getItem('shop_report_token')) return
      if (!user) setLockedAccount(account || null)
    }).catch(() => {})
    return () => { alive = false }
  }, [user, showOnlineLogin])

  const saveAuth = useCallback(async (data, pin) => {
    sessionStorage.setItem('shop_report_token', data.token)
    sessionStorage.setItem('shop_report_user', JSON.stringify(data.user))
    if (pin) await rememberOfflineAccount(data.user, data.user.phoneNumber, pin).catch((error) => console.warn('Offline account setup failed:', error.message))
    setLockedAccount(null)
    setShowOnlineLogin(false)
    setOffline(false)
    setOfflinePin(pin || '')
    setUser(data.user)
  }, [])

  const unlockOffline = useCallback(async (pin) => {
    const account = await verifyOfflinePin(pin)
    if (!account) return { success: false, message: 'Incorrect offline PIN.' }
    if (navigator.onLine) {
      try {
        const { data } = await api.post('/auth/login', { phoneNumber: account.phoneNumber, pin })
        await saveAuth(data.data, pin)
        return { success: true }
      } catch (error) {
        if (error.response && error.response.status < 500 && error.response.status !== 429) {
          return { success: false, message: error.response.data?.message || 'Online sign-in failed.' }
        }
      }
    }
    setUser(account.user)
    setOffline(true)
    setOfflinePin(pin)
    setLockedAccount(null)
    return { success: true, offline: true }
  }, [saveAuth])

  const startOnlineLogin = useCallback(() => {
    setUser(null)
    setOffline(false)
    setOfflinePin('')
    setLockedAccount(null)
    setShowOnlineLogin(true)
  }, [])

  const reauthenticate = useCallback(async (providedPin) => {
    const pin = providedPin || offlinePin
    if (!pin) return false
    const account = await getOfflineAccount()
    if (!account?.phoneNumber) return false
    try {
      const { data } = await api.post('/auth/login', { phoneNumber: account.phoneNumber, pin })
      await saveAuth(data.data, pin)
      return true
    } catch {
      return false
    }
  }, [offlinePin, saveAuth])

  const logout = useCallback(async () => {
    const currentId = String(user?._id || user?.id || '')
    const pendingCount = currentId ? await offlineDb.operations.where('userId').equals(currentId).count() : 0
    if (pendingCount && !window.confirm(`Logging out will permanently clear ${pendingCount} queued offline operation(s). Continue?`)) return false
    await clearPrivateData()
    sessionStorage.removeItem('shop_report_token')
    sessionStorage.removeItem('shop_report_user')
    setLockedAccount(null)
    setShowOnlineLogin(false)
    setOffline(false)
    setOfflinePin('')
    setUser(null)
    return true
  }, [user])

  return { user, saveAuth, logout, lockedAccount, showOnlineLogin, offline, offlinePin, unlockOffline, startOnlineLogin, reauthenticate }
}

function useApi(path, options = {}) {
  const params = options.params
  const initial = options.initial ?? null
  const enabled = options.enabled ?? true
  const refreshMs = options.refreshMs || 0
  const { mode } = useContext(PreferencesContext)
  const sync = useOfflineSync()
  const userId = sync?.userId
  const initialRef = useRef(initial)
  const [state, setState] = useState({ data: initial, loading: enabled, error: '' })
  const [poll, setPoll] = useState(0)
  const key = JSON.stringify(params || {})

  useEffect(() => {
    if (!enabled) {
      setState({ data: initialRef.current, loading: false, error: '' })
      return undefined
    }
    let alive = true
    const requestParams = key ? JSON.parse(key) : undefined
    setState((current) => ({ ...current, loading: true, error: '' }))
    const readCache = async (message) => {
      const cached = await getCachedApiData(userId, path, requestParams).catch(() => null)
      if (!alive) return
      if (cached) setState({ data: cached.data, meta: cached.meta, loading: false, error: '' })
      else setState({ data: initialRef.current, loading: false, error: message || 'No saved copy is available on this device.' })
    }
    if (mode === 'offline' || !navigator.onLine) {
      readCache('No saved copy is available on this device. Connect to the internet to load this page.').catch(() => {})
    } else {
      api.get(path, { params: requestParams })
        .then(({ data }) => {
          if (!alive) return
          setState({ data: data.data, meta: data.meta, loading: false, error: '' })
          cacheApiData(userId, path, requestParams, data.data, data.meta).catch(() => {})
        })
        .catch((error) => readCache(apiMessage(error)).catch(() => alive && setState({ data: initialRef.current, loading: false, error: apiMessage(error) })))
    }
    return () => { alive = false }
  }, [path, key, enabled, poll, userId, mode])

  useEffect(() => {
    if (!enabled || !refreshMs) return undefined
    const id = window.setInterval(() => setPoll((value) => value + 1), refreshMs)
    return () => window.clearInterval(id)
  }, [enabled, refreshMs])

  return state
}

function apiMessage(error) {
  if (error.code === 'ERR_NETWORK' || (!error.response && error.request)) {
    return `Cannot reach the server at ${API_BASE_URL}. Check the API URL and server connection, then try again.`
  }
  return error.response?.data?.message || error.message || 'Something went wrong'
}

function Card({ children, className = '' }) {
  return <section className={'card ' + className}>{children}</section>
}

function AppShell({ children, title, auth, productHeader = false, saleHeader = false }) {
  const { t, mode, theme, setTheme } = useContext(PreferencesContext)
  const [open, setOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(true)
  const [accountOpen, setAccountOpen] = useState(true)
  const navigate = useNavigate()
  const [globalSearch, setGlobalSearch] = useState('')
  const globalSearchRef = useRef(null)
  const themeToggle = <button className="icon-button header-theme-toggle" type="button" aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} title={theme === 'dark' ? 'Light mode' : 'Dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}</button>
  const initials = auth.user?.name?.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase() || 'SR'
  useEffect(() => {
    if (!saleHeader) return undefined
    const onShortcut = (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); globalSearchRef.current?.focus() } }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [saleHeader])

  return <div className={'app-shell' + (productHeader ? ' product-shell' : '') + (saleHeader ? ' sale-shell' : '')}>
    {open && <button className="scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={'sidebar ' + (open ? 'open' : '')}>
      <div className="brand">
        <div className="brand-mark"><ReceiptText size={21} /></div>
        <div><strong>MANAGEYOURSTOCK</strong></div>
        <button className="mobile-close" onClick={() => setOpen(false)}><X size={18} /></button>
      </div>
      <div className="shop-label">BUSINESS WORKSPACE</div>
      <nav className="side-navigation">
        <NavLink to="/dashboard" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><LayoutGrid size={17} /><span>{t('Dashboard')}</span></NavLink>
        <button className="side-section" onClick={() => setStockOpen((value) => !value)} aria-expanded={stockOpen}><span><Boxes size={17} /> {t('STOCK')}</span><ChevronDown size={15} className={stockOpen ? 'section-chevron open' : 'section-chevron'} /></button>
        {stockOpen && <div className="side-subnav">
          <NavLink to="/products" end onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><Package size={16} /><span>{t('All Products')}</span></NavLink>
          <NavLink to="/sold-products" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><ShoppingCart size={16} /><span>{t('Sold Products')}</span></NavLink>

          <NavLink to="/reports" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><FileText size={16} /><span>{t('Reports')}</span></NavLink>
          <NavLink to="/transactions/new" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><ShoppingCart size={16} /><span>{t('Record Sale')}</span></NavLink>
          {canManageAdmin(auth.user) && <NavLink to="/products/new" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active add-product-link' : 'add-product-link'}><Plus size={16} /><span>{t('Add Product')}</span></NavLink>}
        </div>}
        <button className="side-section account-section" onClick={() => setAccountOpen((value) => !value)} aria-expanded={accountOpen}><span><UserRound size={17} /> {t('ACCOUNT')}</span><ChevronDown size={15} className={accountOpen ? 'section-chevron open' : 'section-chevron'} /></button>
        {accountOpen && <div className="side-subnav">
          <NavLink to="/account" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><CircleUserRound size={16} /><span>{t('Account Information')}</span></NavLink>
          {canManageAdmin(auth.user) && <NavLink to="/users" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><Users size={16} /><span>{t('Users')}</span></NavLink>}
          <NavLink to="/settings" onClick={() => setOpen(false)} className={({ isActive }) => isActive ? 'active' : ''}><Settings size={16} /><span>{t('Settings')}</span></NavLink>
        </div>}
      </nav>
      <button className="logout" onClick={async () => { if (await auth.logout()) navigate('/login') }}><LogOut size={18} /> {t('Logout')}</button>
      <p className="sidebar-foot">manageyourstock</p>
    </aside>
    <main>
      <header className="topbar">
        <button className="menu-button" onClick={() => setOpen(true)}><Menu size={21} /></button>
        {productHeader ? <><div className="product-breadcrumb"><span>{t('Overview')}</span><b>/</b><strong>{t(title)}</strong></div><div className="product-top-actions"><span>Kigali Main Store</span>{themeToggle}<div className="avatar">{initials}</div><div className="user-name"><strong>{auth.user?.name || 'Shop User'}</strong><span>{auth.user?.role || 'USER'}</span></div></div></> : saleHeader ? <><div className="sale-header-title"><ReceiptText size={16} /><strong>{t(title)}</strong></div><form className="global-search" onSubmit={(event) => { event.preventDefault(); navigate('/products', { state: { search: globalSearch.trim() } }) }}><button className="global-search-submit" type="submit" aria-label="Search products" title="Search products"><Search size={15} /></button><input ref={globalSearchRef} value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Search products... (Ctrl+K)" /><kbd>Ctrl K</kbd></form>{themeToggle}<div className="sale-header-avatar">{initials}</div></> : <><div><p className="eyebrow">{t('Overview').toUpperCase()}</p><h1>{t(title)}</h1></div>
        <div className="top-actions">
          {themeToggle}
          <div className="avatar">{initials}</div>
          <div className="user-name"><strong>{auth.user?.name || 'Shop User'}</strong><span>{auth.user?.role || 'USER'}</span></div>
          <ChevronDown size={16} />
        </div></>}
      </header>
      <OfflineSyncStatus t={t} mode={mode} />
      {localizeNode(children, t)}
    </main>
  </div>
}

function DateControls({ range, setRange, compact = false, onSearch }) {
  const { t } = useContext(PreferencesContext)
  return <div className={'date-controls ' + (compact ? 'compact' : '')}>
    <label><span>{t("From date")}</span><input type="date" value={range.fromDate} onChange={(e) => setRange({ ...range, fromDate: e.target.value })} /></label>
    <label><span>{t("To date")}</span><input type="date" value={range.toDate} onChange={(e) => setRange({ ...range, toDate: e.target.value })} /></label>
    <button className="button secondary" onClick={() => setRange({ ...range, fromDate: monthStart, toDate: today })}><CalendarDays size={16} /> {t("This month")}</button>
    <button type="button" className="button" onClick={onSearch}><Search size={16} /> {t("Search")}</button>
  </div>
}

function TableState({ loading, error, empty, colSpan = 7 }) {
  const { t } = useContext(PreferencesContext)
  if (loading) return <tr><td colSpan={colSpan} className="empty-cell">{t("Loading records...")}</td></tr>
  if (error) return <tr><td colSpan={colSpan} className="empty-cell">{error}</td></tr>
  if (empty) return <tr><td colSpan={colSpan} className="empty-cell">{t("No records found.")}</td></tr>
  return null
}

function TransactionTable({ rows = [], loading, error, adding = false, draft = emptyTransaction, setDraft, onSave, onCancel, saving = false, onUpdate, onDelete, currentUser }) {
  const { t } = useContext(PreferencesContext)
  const [editingId, setEditingId] = useState('')
  const [editDraft, setEditDraft] = useState(emptyTransaction)
  const [editing, setEditing] = useState(false)
  const totals = rows.reduce((sum, row) => ({
    paidAmount: sum.paidAmount + Number(row.paidAmount || 0),
    cashOut: sum.cashOut + Number(row.cashOut || 0),
    cashIn: sum.cashIn + cashInFor(row),
    remainingAmount: sum.remainingAmount + Number(row.remainingAmount || 0),
  }), { paidAmount: 0, cashOut: 0, cashIn: 0, remainingAmount: 0 })
  const draftCashIn = cashInFor(draft)
  const editCashIn = cashInFor(editDraft)
  const canChangeRows = Boolean(onUpdate || onDelete)
  const startEdit = (row) => {
    setEditingId(row._id)
    setEditDraft({
      productId: idOf(row.productId) || '', quantity: row.quantity ?? 1, unitPrice: row.unitPrice ?? '',
      productName: row.productOrService || row.serviceOrProduct || '',
      paidAmount: row.paidAmount ?? '',
      cashOut: row.cashOut ?? '',
      remainingAmount: row.remainingAmount ?? '',
      paymentMethod: row.paymentMethod || 'CASH',
      description: row.notes || '',
    })
  }
  const saveEdit = async () => {
    setEditing(true)
    try {
      await onUpdate?.(editingId, editDraft)
      setEditingId('')
      setEditDraft(emptyTransaction)
    } finally {
      setEditing(false)
    }
  }

  return <div className="table-wrap"><table className="transaction-table">
    <thead><tr><th>{t("Date")}</th><th>{t("User")}</th><th>{t("Product name")}</th><th>{t("Amount")}</th><th>{t("Cash Out")}</th><th>{t("Cash In")}</th><th>{t("Rest")}</th><th>{t("Method")}</th><th>{t("Description")}</th><th></th></tr></thead>
    <tbody>
      {adding && <tr className="inline-row">
        <td>{t("Today")}</td>
        <td>{t("Me")}</td>
        <td><input required value={draft.productName} onChange={(e) => setDraft({ ...draft, productName: e.target.value })} placeholder={t("Product name")} /></td>
        <td><input required min="0" type="number" value={draft.paidAmount} onChange={(e) => setDraft({ ...draft, paidAmount: e.target.value })} placeholder="0" /></td>
        <td><input required min="0" type="number" value={draft.cashOut} onChange={(e) => setDraft({ ...draft, cashOut: e.target.value })} placeholder="0" /></td>
        <td>{money(draftCashIn)} <small>RWF</small></td>
        <td><input required min="0" type="number" value={draft.remainingAmount} onChange={(e) => setDraft({ ...draft, remainingAmount: e.target.value })} placeholder="0" /></td>
        <td><Select value={draft.paymentMethod} onChange={(paymentMethod) => setDraft({ ...draft, paymentMethod })} /></td>
        <td><input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={t("Optional")} /></td>
        <td className="row-buttons"><button className="button" onClick={onSave} disabled={saving}>{saving ? t("Saving...") : t("Save")}</button><button className="button secondary" onClick={onCancel}>{t("Cancel")}</button></td>
      </tr>}
      <TableState loading={loading} error={error} empty={!rows.length && !adding} colSpan={10} />
      {rows.map((row) => editingId === row._id ? <tr key={row._id} className="inline-row">
        <td>{new Date(row.saleDate || row.transactionDate || row.createdAt).toLocaleDateString()}</td>
        <td>{row.staff?.fullName || row.staff?.name || row.createdBy?.fullName || row.createdBy?.name || '-'}</td>
        <td><input required value={editDraft.productName} onChange={(e) => setEditDraft({ ...editDraft, productName: e.target.value })} /></td>
        <td><input required min="0" type="number" value={editDraft.paidAmount} onChange={(e) => setEditDraft({ ...editDraft, paidAmount: e.target.value })} /></td>
        <td><input required min="0" type="number" value={editDraft.cashOut} onChange={(e) => setEditDraft({ ...editDraft, cashOut: e.target.value })} /></td>
        <td>{money(editCashIn)} <small>RWF</small></td>
        <td><input required min="0" type="number" value={editDraft.remainingAmount} onChange={(e) => setEditDraft({ ...editDraft, remainingAmount: e.target.value })} /></td>
        <td><Select value={editDraft.paymentMethod} onChange={(paymentMethod) => setEditDraft({ ...editDraft, paymentMethod })} /></td>
        <td><input value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} /></td>
        <td className="row-buttons"><button className="button" onClick={saveEdit} disabled={editing}>{editing ? t("Saving...") : t("Save")}</button><button className="button secondary" onClick={() => setEditingId('')}>{t("Cancel")}</button></td>
      </tr> : <tr key={row._id}>
        <td>{new Date(row.saleDate || row.transactionDate || row.createdAt).toLocaleDateString()}</td>
        <td>{row.staff?.fullName || row.staff?.name || row.createdBy?.fullName || row.createdBy?.name || '-'}</td>
        <td><strong>{row.productOrService || row.serviceOrProduct}</strong></td>
        <td>{money(row.paidAmount)} <small>RWF</small></td>
        <td>{money(row.cashOut)} <small>RWF</small></td>
        <td>{money(cashInFor(row))} <small>RWF</small></td>
        <td>{money(row.remainingAmount)} <small>RWF</small></td>
        <td>{row.paymentMethod === 'MOMO' ? t('MoMo Pay') : t('Cash')}</td>
        <td>{row.notes || '-'}</td>
        <td>{canChangeRows && isOwnTransaction(row, currentUser) && <><button className="row-action" onClick={() => startEdit(row)}><Edit2 size={16} /></button><button className="row-action" onClick={() => confirmDelete() && onDelete?.(row._id)}><Trash2 size={16} /></button></>}</td>
      </tr>)}
      <tr className="total-row"><td colSpan="3">{t("Total")}</td><td>{money(totals.paidAmount)} <small>RWF</small></td><td>{money(totals.cashOut)} <small>RWF</small></td><td>{money(totals.cashIn)} <small>RWF</small></td><td>{money(totals.remainingAmount)} <small>RWF</small></td><td colSpan="3"></td></tr>
    </tbody>
  </table></div>
}

function Dashboard({ auth }) {
  const isAdmin = canManageAdmin(auth.user)
  const [range, setRange] = useState({ fromDate: monthStart, toDate: today })
  const [refresh, setRefresh] = useState(0)
  const updateTransaction = async (id, data) => {
    await api.put(`/transactions/${id}`, data)
    setRefresh((value) => value + 1)
  }
  const deleteTransaction = async (id) => {
    await api.delete(`/transactions/${id}`)
    setRefresh((value) => value + 1)
  }
  const summary = useApi('/dashboard/summary', { params: { ...range, dashboardView: isAdmin ? 'system' : 'personal', refresh }, initial: {}, refreshMs: liveRefreshMs })
  const recent = useApi('/transactions', { params: { ...range, limit: 5, dashboard: 'true', refresh }, initial: [], refreshMs: liveRefreshMs })
  const stock = useApi('/expenses', { params: { ...range, refresh }, initial: [], enabled: isAdmin, refreshMs: liveRefreshMs })
  const productInventory = useApi('/products', { params: { refresh }, initial: [], enabled: isAdmin, refreshMs: liveRefreshMs })
  const data = summary.data || {}
  const amount = data.totalAmount || data.totalPaid || data.paidAmount || 0
  const cashOut = data.totalCashOut || 0
  const cashIn = data.totalCashIn ?? data.totalMoneyEarned ?? amount - cashOut
  const unpaid = data.totalRemaining || data.notPaid || 0
  const productRows = productInventory.data || []
  const activeProducts = productRows.filter((product) => product.status === 'ACTIVE')
  const inventoryUnits = productRows.reduce((sum, product) => sum + Number(product.quantity || 0), 0)
  const inventoryValue = productRows.reduce((sum, product) => sum + Number(product.costPrice || 0) * Number(product.quantity || 0), 0)
  const lowStockProducts = activeProducts.filter((product) => Number(product.quantity || 0) > 0 && Number(product.quantity) <= Number(product.lowStockLevel || 0))
  const outOfStockProducts = activeProducts.filter((product) => Number(product.quantity || 0) === 0)
  const pie = [{ name: 'Cash In', value: cashIn, color: '#246bfd' }, { name: 'Remaining', value: unpaid, color: '#f3ae35' }]

  return <AppShell title="Dashboard" auth={auth}><div className="page-content">
    <div className="dashboard-welcome"><div><span className="eyebrow">{isAdmin ? 'BUSINESS OVERVIEW' : 'PERSONAL OVERVIEW'}</span><h2>{isAdmin ? 'Stock and sales at a glance' : 'Your sales at a glance'}</h2><p>{isAdmin ? 'Monitor cash flow, inventory levels, and recent activity.' : 'Review your sales and payments received during the selected period.'}</p></div><button type="button" className="button secondary" onClick={() => setRefresh((value) => value + 1)} disabled={summary.loading || productInventory.loading}><RefreshCw size={15} /> Refresh dashboard</button></div>
    <DateControls range={range} setRange={setRange} onSearch={() => setRefresh((value) => value + 1)} />
    {summary.error && <Notice tone="error">{summary.error}</Notice>}
    {isAdmin && productInventory.error && <Notice tone="error">{productInventory.error}</Notice>}
    <div className="dashboard-stat-grid">{[
      [CircleDollarSign, 'Payments received', money(amount), 'RWF', 'Customer payments during selected period', 'green'],
      [Wallet, 'Cash out', money(cashOut), 'RWF', 'Recorded expenses against sales', 'orange'],
      [CircleDollarSign, 'Net cash', money(cashIn), 'RWF', 'Payments received after cash out', 'blue'],
      [Wallet, 'Outstanding balance', money(unpaid), 'RWF', 'Remaining customer balance', 'orange'],
      [ClipboardList, 'Sales recorded', data.transactionCount || 0, '', 'During selected period', 'purple'],
      ...(isAdmin ? [
        [Package, 'Units in stock', money(inventoryUnits), '', `${activeProducts.length} active products`, 'blue'],
        [CircleDollarSign, 'Current stock value', money(inventoryValue), 'RWF', 'Quantity multiplied by cost price', 'teal'],
        [Package, 'Low / out of stock', lowStockProducts.length + outOfStockProducts.length, '', `${outOfStockProducts.length} out of stock`, 'orange'],
      ] : []),
    ].map(([Icon, label, value, unit, note, color]) => <Card className="stat-card dashboard-stat-card" key={label}>
      <div className={'stat-icon ' + color}><Icon size={19} /></div><p>{label}</p><h2>{value} <small>{unit}</small></h2><span className="change">{note}</span>
    </Card>)}</div>
    <div className="dashboard-grid">
      <Card className="recent"><SectionTitle title={isAdmin ? 'Recent transactions' : 'Your recent sales'} text={isAdmin ? 'Latest sales activity' : 'Products you sold during the selected period'} link="/transactions" /><TransactionTable rows={recent.data || []} loading={recent.loading} error={recent.error} onUpdate={updateTransaction} onDelete={deleteTransaction} currentUser={auth.user} /></Card>
      <Card className="payment-card">
        <div className="section-title"><div><h2>Payment summary</h2><p>Selected period</p></div></div>
        <div className="chart"><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={pie} dataKey="value" innerRadius={52} outerRadius={72} paddingAngle={4} stroke="none">{pie.map((x) => <Cell key={x.name} fill={x.color} />)}</Pie><Tooltip formatter={(v) => `${money(v)} RWF`} /></PieChart></ResponsiveContainer><div className="chart-total"><strong>{money(cashIn)}</strong><span>Cash In</span></div></div>
        <div className="legend">{pie.map((x) => <div key={x.name}><i style={{ background: x.color }} /><span>{x.name}</span><strong>{money(x.value)} RWF</strong></div>)}</div>
      </Card>
    </div>
    {isAdmin && <><div className="dashboard-grid dashboard-single"><Card className="recent"><SectionTitle title="Low stock products" text="Products at or below their alert level" link="/products" /><LowStockList items={[...outOfStockProducts, ...lowStockProducts].slice(0, 8)} /></Card></div>
    <Card className="recent dashboard-stock"><SectionTitle title="Recent imported stock" text="Latest inventory purchases by all users" link="/expenses" /><ResourceTable type="expenses" rows={(stock.data || []).slice(0, 5)} loading={stock.loading} error={stock.error} /></Card></>}
    <Card className="quick"><div><h2>Quick actions</h2><p>Work faster</p></div><NavLink className="quick-action" to="/transactions/new"><Plus /> New transaction</NavLink>{canManageAdmin(auth.user) && <NavLink className="quick-action" to="/products/new"><Plus /> New product</NavLink>}<NavLink className="quick-action muted" to="/reports"><BarChart3 /> View reports</NavLink></Card>
  </div></AppShell>
}

function SectionTitle({ title, text, link, action }) {
  const { t } = useContext(PreferencesContext)
  return <div className="section-title"><div><h2>{t(title)}</h2><p>{t(text)}</p></div>{action || (link && <NavLink to={link}>{t('View all')}</NavLink>)}</div>
}

function Notice({ children, tone = 'info' }) {
  return <div className={'notice ' + tone}>{children}</div>
}

function confirmDelete() {
  return window.confirm('Are you sure you want to delete this row?')
}

function OfflineUnlock({ auth }) {
  const { t } = useContext(PreferencesContext)
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const unlock = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      const result = await auth.unlockOffline(pin)
      if (!result.success) setError(result.message)
      else navigate(result.offline ? '/transactions/new' : '/dashboard', { replace: true })
    } catch (unlockError) {
      setError(unlockError.message || 'Could not unlock this device.')
    } finally {
      setLoading(false)
    }
  }
  return <div className="login"><div className="login-panel">
    <div className="login-brand"><div className="brand-mark"><ReceiptText /></div><strong>MANAGEYOURSTOCK</strong></div>
    <div className="login-copy"><h1>{t('Unlock offline data')}</h1><p>{auth.lockedAccount?.user?.name || t('Your account')} · Enter your account password to access saved products and queued work.</p></div>
    {error && <Notice tone="error">{error}</Notice>}
    <form className="login-form" onSubmit={unlock}>
      <label><span>Password</span><input type="password" autoComplete="current-password" autoFocus value={pin} onChange={(event) => setPin(event.target.value)} /></label>
      <button className="login-button" disabled={!pin || loading}>{loading ? t('Unlocking…') : t('Unlock this device')}</button>
    </form>
    <button className="button secondary offline-online-login" type="button" onClick={auth.startOnlineLogin}>{t('Sign in online instead')}</button>
  </div></div>
}

function Login({ auth }) {
  const { t } = useContext(PreferencesContext)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const login = async (event) => {
    event?.preventDefault()
    setLoading(true); setError('')
    try {
      const { data } = await api.post('/auth/login', { phoneNumber, password })
      await auth.saveAuth(data.data, password)
      navigate('/dashboard')
    } catch (error) {
      setError(apiMessage(error))
    } finally {
      setLoading(false)
    }
  }

  return <div className="login">
    <div className="login-panel">
      <div className="login-brand"><div className="brand-mark"><ReceiptText /></div><strong>MANAGEYOURSTOCK</strong></div>
      <div className="login-copy"><h1>{t("Sign in")}</h1><p>Enter your phone number and password.</p></div>
      {error && <Notice tone="error">{error}</Notice>}
      <form className="login-form" onSubmit={login}>
        <label><span>{t("Phone number")}</span><input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="numeric" autoComplete="username" autoFocus placeholder={t('Enter phone number')} /></label>
        <label><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        <button className="login-button" disabled={!password || phoneNumber.length < 7 || loading}>{loading ? t("Signing in...") : t("Sign in securely")}</button>
      </form>
    </div>
  </div>
}

function TransactionsPage({ auth, title = 'Transactions' }) {
  const [range, setRange] = useState({ fromDate: monthStart, toDate: today })
  const [refresh, setRefresh] = useState(0)
  const updateTransaction = async (id, data) => {
    await api.put(`/transactions/${id}`, data)
    setRefresh((value) => value + 1)
  }
  const deleteTransaction = async (id) => {
    await api.delete(`/transactions/${id}`)
    setRefresh((value) => value + 1)
  }
  const list = useApi('/transactions', { params: { ...range, limit: 50, refresh }, initial: [], refreshMs: liveRefreshMs })
  return <AppShell title={title} auth={auth}><div className="page-content">
    <Hero title={title} text="Record and review customer sales." action="/transactions/new" actionText="Record sale" />
    <DateControls range={range} setRange={setRange} compact onSearch={() => setRefresh((value) => value + 1)} />
    <Card className="recent"><SectionTitle title="All transactions" text="Showing records from your selected period" /><TransactionTable rows={list.data || []} loading={list.loading} error={list.error} onUpdate={updateTransaction} onDelete={deleteTransaction} currentUser={auth.user} /></Card>
  </div></AppShell>
}

function SoldProductsPage({ auth }) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [payment, setPayment] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 10
  const list = useApi('/transactions', { params: { limit: 200, refresh }, initial: [], refreshMs: liveRefreshMs })
  const rows = (list.data || []).filter((row) => {
    const product = row.productId || {}
    const text = `${row.serviceOrProduct || row.productOrService || ''} ${product.name || ''} ${product.sku || ''} ${product.category || ''} ${product.description || ''}`.toLowerCase()
    return (!search || text.includes(search.toLowerCase())) && (!category || product.category === category) && (!payment || row.paymentMethod === payment)
  })
  const categories = [...new Set((list.data || []).map((row) => row.productId?.category).filter(Boolean))].sort()
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const visiblePage = Math.min(page, pageCount)
  const visibleRows = rows.slice((visiblePage - 1) * pageSize, visiblePage * pageSize)
  const removeSale = async (row) => {
    const productName = row.serviceOrProduct || row.productOrService
    if (!window.confirm(`Delete this ${productName} sale? Its sold quantity will be returned to stock.`)) return
    try { await api.delete(`/transactions/${row._id}`); setRefresh((value) => value + 1) } catch (error) { window.alert(apiMessage(error)) }
  }
  const totalSales = rows.length
  return <AppShell title="Sold Products" auth={auth} saleHeader><div className="page-content sold-products-page">
    <div className="sold-product-filters"><label className="catalog-search"><Search size={14} /><input placeholder="Search by product, category, SKU, model..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} /></label><select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }}><option value="">All Categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by payment type" value={payment} onChange={(event) => { setPayment(event.target.value); setPage(1) }}><option value="">All Payment Types</option><option value="CASH">Cash</option><option value="MOMO">Mobile Money</option><option value="CARD">Card</option><option value="BANK">Bank</option><option value="OTHER">Other</option></select><button type="button" className="button secondary" onClick={() => setRefresh((value) => value + 1)} disabled={list.loading}><RefreshCw size={13} /> Refresh</button></div>
    {list.error && <Notice tone="error">{list.error} <button className="button secondary" type="button" onClick={() => setRefresh((value) => value + 1)}>Retry</button></Notice>}
    {list.loading && !list.data?.length ? <div className="sold-products-loading">Loading sold products...</div> : <div className="sold-product-grid">{visibleRows.map((row) => {
      const product = row.productId || {}
      const name = row.serviceOrProduct || row.productOrService || product.name || 'Product'
      const quantity = Number(row.quantity || 0)
      const revenue = Number(row.totalAmount ?? quantity * Number(row.unitPrice || 0))
      const unitCost = Number(row.unitCost ?? product.costPrice ?? 0)
      const profit = revenue - quantity * unitCost
      const date = new Date(row.transactionDate || row.saleDate || row.createdAt)
      return <article className="sold-product-card" key={row._id}>
        <div className="sold-product-image"><div className="sold-image-placeholder"><Package size={36} /><span>{product.category || 'PRODUCT'}</span></div><span className="sold-payment-badge">{row.paymentMethod || 'SALE'}</span></div>
        <div className="sold-product-body"><div className="sold-product-title"><strong>{name}</strong><span>{product.location || 'Main Store'}</span></div><p className="sold-product-subtitle">{product.category || 'Product'}{product.brand ? ` Â· ${product.brand}` : ''}{product.sku ? ` Â· ${product.sku}` : ''}</p><div className="sold-metrics"><span>Quantity<br /><b>{quantity} {product.unit || 'Pcs'}</b></span><span>Unit Price<br /><b>{money(row.unitPrice)} RWF</b></span></div><div className="sold-metrics"><span>Purchase Cost<br /><b>{money(unitCost)} RWF</b></span><span>Total Revenue<br /><b>{money(revenue)} RWF</b></span></div>{row.customerName && <div className="sold-customer">Customer: {row.customerName}</div>}</div>
        <div className="sold-product-footer"><span>{Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()}</span><div className="sold-footer-actions"><b>Profits: {money(profit)} RWF</b>{canManageBusiness(auth.user) && <button title="Delete sale and restore stock" aria-label="Delete sale and restore stock" onClick={() => removeSale(row)}><RotateCcw size={14} /></button>}</div></div>
      </article>
    })}{!list.error && !visibleRows.length && <Card className="catalog-state">No sold products found.</Card>}</div>}
    <div className="catalog-pagination"><span>Showing {rows.length ? (visiblePage - 1) * pageSize + 1 : 0} to {Math.min(visiblePage * pageSize, totalSales)} of {totalSales} sales records</span><div><button disabled={visiblePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>â€¹ Previous</button><b>{visiblePage}</b><button disabled={visiblePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next â€º</button></div></div>
  </div></AppShell>
}

const blankProduct = { name: '', sku: '', category: '', brand: '', description: '', unit: 'Pieces (pcs)', costPrice: 0, sellingPrice: '', quantity: 0, lowStockLevel: 5, location: 'Shelf A2', supplier: '', status: 'ACTIVE', notes: '' }

function LowStockList({ items = [] }) {
  const { t } = useContext(PreferencesContext)
  if (!items.length) return <p className="empty-cell">{t("No products are currently low on stock.")}</p>
  return <div className="low-stock-list">{items.map((product) => <div key={product._id}><strong>{product.name}</strong><span>{product.location}</span><b className={Number(product.quantity) === 0 ? 'stock-badge out' : 'stock-badge low'}>{Number(product.quantity) === 0 ? 'Out of Stock' : `Low Stock Â· ${product.quantity}`}</b></div>)}</div>
}

function ProductsPage({ auth, initialAdd = false }) {
  const { t, mode } = useContext(PreferencesContext)
  const offlineSync = useOfflineSync()
  const navigate = useNavigate()
  const location = useLocation()
  const [filters, setFilters] = useState({ search: location.state?.search || '', category: '', brand: '', status: '', lowStock: '' })
  const [refresh, setRefresh] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [cardView, setCardView] = useState(true)
  const [selectedRows, setSelectedRows] = useState([])
  const [formOpen, setFormOpen] = useState(initialAdd)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(blankProduct)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [combinedCost, setCombinedCost] = useState(false)
  const [manageOptionsOpen, setManageOptionsOpen] = useState(false)
  const [optionType, setOptionType] = useState('category')
  const [optionName, setOptionName] = useState('')
  const [optionEdit, setOptionEdit] = useState(null)
  const [optionError, setOptionError] = useState('')
  const [optionsRefresh, setOptionsRefresh] = useState(0)
  useEffect(() => {
    if (location.state?.search !== undefined) setFilters((current) => ({ ...current, search: location.state.search || '' }))
  }, [location.key, location.state?.search])
  const params = Object.fromEntries(Object.entries({ ...filters, refresh }).filter(([key, value]) => key !== 'brand' && key !== 'sort' && value !== ''))
  const list = useApi('/products', { params, initial: [], refreshMs: liveRefreshMs })
  const optionCatalog = useApi('/products/options', { params: { refresh: optionsRefresh }, initial: { categories: [], brands: [], models: [] } })
  const rows = mode === 'offline'
    ? offlineSync.products
    : (list.data?.length ? list.data : offlineSync.products)
  const categories = [...new Set([...(optionCatalog.data?.categories || []), ...rows.map((row) => row.category).filter(Boolean)])]
  const brands = [...new Set([...(optionCatalog.data?.brands || []), ...rows.map((row) => row.brand).filter(Boolean)])]
  const models = [...new Set([...(optionCatalog.data?.models || []), ...rows.map((row) => row.description).filter(Boolean)])]
  const startAdd = () => { setEditingId(''); setForm(blankProduct); setCombinedCost(false); setFormOpen(true); setError(''); setMessage(''); navigate('/products/new') }
  const startEdit = (row) => { setEditingId(row._id); setForm({ ...blankProduct, ...row, sku: row.sku || '' }); setFormOpen(true); setError(''); setMessage('') }
  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('')
    const quantity = Number(form.quantity)
    const enteredCost = Number(form.costPrice || 0)
    const body = { ...form, costPrice: combinedCost && quantity ? enteredCost / quantity : enteredCost, sellingPrice: Number(form.sellingPrice || 0), quantity, lowStockLevel: Number(form.lowStockLevel) }
    try {
      if (editingId) await api.put(`/products/${editingId}`, body)
      else await api.post('/products', body)
      setFormOpen(false); setEditingId(''); setForm(blankProduct); setRefresh((v) => v + 1); setMessage(editingId ? 'Product updated.' : 'Product added.'); navigate('/products')
    } catch (submitError) { setError(apiMessage(submitError)) } finally { setSaving(false) }
  }
  const remove = async (product) => {
    if (!confirm(`Delete ${product.name}?`)) return
    setError(''); setMessage('')
    try { await api.delete(`/products/${product._id}`); setRefresh((v) => v + 1); setMessage('Product deleted.') } catch (deleteError) { setError(apiMessage(deleteError)) }
  }
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const saveOption = async (event) => {
    event.preventDefault()
    const name = optionName.trim()
    if (!name) return
    setOptionError('')
    try {
      await api.post('/products/options', { type: optionType, name })
      setOptionName('')
      setOptionsRefresh((value) => value + 1)
    } catch (optionSaveError) { setOptionError(apiMessage(optionSaveError)) }
  }
  const renameOption = async (event) => {
    event.preventDefault()
    const nextName = optionEdit?.value?.trim()
    if (!nextName) return
    setOptionError('')
    try {
      await api.patch(`/products/options/${optionEdit.type}`, { name: optionEdit.name, newName: nextName })
      setOptionEdit(null)
      setOptionsRefresh((value) => value + 1)
      setRefresh((value) => value + 1)
    } catch (optionSaveError) { setOptionError(apiMessage(optionSaveError)) }
  }
  const deleteOption = async (type, name) => {
    if (!window.confirm(`Remove “${name}”? Products using this ${type} will keep the product, but this value will be cleared.`)) return
    setOptionError('')
    try {
      await api.patch(`/products/options/${type}`, { name, newName: null })
      setOptionsRefresh((value) => value + 1)
      setRefresh((value) => value + 1)
    } catch (optionSaveError) { setOptionError(apiMessage(optionSaveError)) }
  }
  const visibleRows = rows.filter((row) => (!filters.brand || row.brand === filters.brand)
    && (!filters.category || row.category === filters.category)
    && (!filters.status || row.status === filters.status)
    && (!filters.search || `${row.name} ${row.sku || ''} ${row.category || ''} ${row.brand || ''} ${row.description || ''} ${row.location || ''}`.toLowerCase().includes(filters.search.toLowerCase())))
    .sort((a, b) => filters.sort === 'name' ? a.name.localeCompare(b.name) : filters.sort === 'oldest' ? new Date(a.createdAt) - new Date(b.createdAt) : new Date(b.createdAt) - new Date(a.createdAt))
  const pageCount = Math.max(1, Math.ceil(visibleRows.length / pageSize))
  const pageRows = visibleRows.slice((page - 1) * pageSize, page * pageSize)
  const totalQuantity = rows.reduce((sum, row) => sum + Number(row.quantity || 0), 0)
  const toggleRow = (id) => setSelectedRows((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  const duplicate = (row) => { setEditingId(''); setForm({ ...blankProduct, ...row, _id: undefined, name: `${row.name} copy`, sku: '', quantity: 0 }); setFormOpen(true); navigate('/products/new') }
  const setStatus = async (row) => {
    const product = Object.fromEntries(Object.entries(row).filter(([key]) => !['_id', 'createdAt', 'updatedAt', 'addedBy', 'lastUpdatedBy', '__v'].includes(key)))
    try { await api.put(`/products/${row._id}`, { ...product, status: row.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }); setRefresh((value) => value + 1) } catch (statusError) { setError(apiMessage(statusError)) }
  }
  return <AppShell title={formOpen ? (editingId ? 'Edit Product' : 'Add New Product') : 'Products'} auth={auth} saleHeader><div className={'page-content products-content' + (formOpen ? ' product-add-content' : '')}>
    {!formOpen && <div className="products-toolbar"><div><h2>Products</h2><p>{totalQuantity} Total Items ({rows.length} unique products)</p></div><div className="products-toolbar-actions"><button className="button secondary" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={13} /> Refresh</button><div className="view-switch"><button className={cardView ? 'selected' : ''} aria-label="Card view" onClick={() => setCardView(true)}><Grid2X2 size={14} /></button><button className={!cardView ? 'selected' : ''} aria-label="List view" onClick={() => setCardView(false)}><List size={14} /></button></div>{canManageAdmin(auth.user) && mode !== 'offline' && <button className="button secondary" onClick={() => setManageOptionsOpen((value) => !value)}><Settings size={13} /> {manageOptionsOpen ? 'Close options' : 'Manage options'}</button>}<NavLink className="button record-sale-button" to="/transactions/new"><ShoppingCart size={13} /> Record Sale</NavLink>{canManageAdmin(auth.user) && <button className="button" onClick={startAdd}><Plus size={14} /> Add Product</button>}</div></div>}
    {message && <Notice>{message}</Notice>}{error && <Notice tone="error">{error}</Notice>}
    {manageOptionsOpen && !formOpen && <Card className="product-options-manager"><div className="product-options-heading"><div><h3>Manage product options</h3><p>Rename a value to update products using it. Delete clears the value from those products.</p></div></div>{optionError && <Notice tone="error">{optionError}</Notice>}<div className="product-option-tabs">{[['category','Categories'],['brand','Brands'],['model','Models']].map(([type,label]) => <button type="button" className={optionType === type ? 'active' : ''} key={type} onClick={() => { setOptionType(type); setOptionEdit(null); setOptionError('') }}>{label}</button>)}</div><form className="product-option-add" onSubmit={saveOption}><input aria-label="New option name" placeholder={`Add ${optionType}`} value={optionName} onChange={(event) => setOptionName(event.target.value)} required /><button className="button" type="submit"><Plus size={14} /> Add</button></form><div className="product-option-list">{(optionType === 'category' ? categories : optionType === 'brand' ? brands : models).map((name) => <div className="product-option-row" key={`${optionType}-${name}`}>{optionEdit?.type === optionType && optionEdit?.name === name ? <form onSubmit={renameOption}><input autoFocus value={optionEdit.value} onChange={(event) => setOptionEdit({ ...optionEdit, value: event.target.value })} required /><button className="button" type="submit">Save</button><button className="button secondary" type="button" onClick={() => setOptionEdit(null)}>Cancel</button></form> : <><span>{name}</span><div><button type="button" className="button secondary" onClick={() => setOptionEdit({ type: optionType, name, value: name })}><Edit2 size={13} /> Rename</button><button type="button" className="button secondary option-delete" onClick={() => deleteOption(optionType, name)}><Trash2 size={13} /> Delete</button></div></>}</div>)}{!(optionType === 'category' ? categories : optionType === 'brand' ? brands : models).length && <p className="product-option-empty">No {optionType} options yet. Add one above.</p>}</div></Card>}
    {formOpen && <><div className="product-add-heading"><div><h2>{editingId ? 'Edit Product' : 'Register New Stock Product'}</h2><p>Fill in product details to register new inventory stock.</p></div><button type="button" className="button secondary" onClick={() => { setFormOpen(false); navigate('/products') }}>â† Back to Products</button></div><Card className="form-card product-form"><form onSubmit={submit}>
      <section className="product-form-section"><h3>PRODUCT INFORMATION</h3><div className="product-form-grid product-info-grid">
        <Field label={<>Product name <i>*</i></>}><input required placeholder="e.g. iPhone 15 Pro Max" value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
        <ProductChoice label="Category" required value={form.category} options={categories} onChange={(value) => set('category', value)} />
        <ProductChoice label="Brand" required value={form.brand} options={brands} onChange={(value) => set('brand', value)} />
        <ProductChoice label="Model" value={form.description} options={models} onChange={(value) => set('description', value)} />
      </div></section>
      <section className="product-form-section"><h3>STOCK AND PRICING</h3><div className="product-form-grid stock-pricing-grid">
        <Field label={<>Quantity <i>*</i></>}><input required min="0" type="number" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></Field>
        <Field label={<>Unit <i>*</i></>}><select required value={form.unit} onChange={(e) => set('unit', e.target.value)}><option>Pieces (pcs)</option><option>Box</option><option>Pack</option><option>Kg</option><option>Gram</option><option>Liter</option><option>Meter</option></select></Field>
        <MoneyField label={<>Purchase price (per unit) <i>*</i></>} value={form.costPrice} onChange={(value) => set('costPrice', value)} required />
        <MoneyField label="Selling price (per unit)" value={form.sellingPrice} onChange={(value) => set('sellingPrice', value)} placeholder={t("Optional")} />
      </div><label className="total-cost-toggle"><input type="checkbox" checked={combinedCost} onChange={(e) => setCombinedCost(e.target.checked)} /><span>This price is for all items combined (total cost)</span></label></section>
      <section className="product-form-section"><h3>STORAGE AND SUPPLIER</h3><div className="product-form-grid storage-grid">
        
        <Field label={<>{t('Storage location')} <i>*</i></>}><input required placeholder="e.g. Shelf A2, Back store" value={form.location} onChange={(e) => set('location', e.target.value)} /></Field>
        <Field label="Supplier (name or phone number)"><input placeholder="e.g. Apple Store or 0788123456" value={form.supplier} onChange={(e) => set('supplier', e.target.value)} /></Field>
      </div><p className="form-hint">Shown when this product is chosen during a sale.</p></section>
      {editingId && <div className="product-meta">Added {form.createdAt ? new Date(form.createdAt).toLocaleDateString() : 'â€”'} Â· {form.addedBy?.name || form.addedBy?.fullName || auth.user?.name || '-”'} Â· Updated {form.updatedAt ? new Date(form.updatedAt).toLocaleString() : 'â€”'}</div>}
      <div className="form-actions"><button type="button" className="button secondary" onClick={() => { setFormOpen(false); navigate('/products') }}>Cancel / Back</button><button className="button" disabled={saving}>{saving ? 'Saving...' : 'Record New Product'}</button></div></form></Card></>}
    {!formOpen && <><div className="product-catalog-filters"><label className="catalog-search"><Search size={14} /><input placeholder="Search products..." value={filters.search} onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1) }} /></label><select value={filters.brand} onChange={(e) => { setFilters({ ...filters, brand: e.target.value }); setPage(1) }}><option value="">All Brands</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select><select value={filters.category} onChange={(e) => { setFilters({ ...filters, category: e.target.value }); setPage(1) }}><option value="">All Categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select><select value={filters.status} onChange={(e) => { setFilters({ ...filters, status: e.target.value }); setPage(1) }}><option value="">All Statuses</option><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select><select value={filters.sort || 'latest'} onChange={(e) => setFilters({ ...filters, sort: e.target.value })}><option value="latest">Sort: Latest Added</option><option value="oldest">Sort: Oldest Added</option><option value="name">Sort: Product Name</option></select></div>
    {cardView ? <div className="product-card-grid">{mode !== 'offline' && list.loading && <Card className="catalog-state">Loading products...</Card>}{mode !== 'offline' && list.error && !rows.length && <Notice tone="error">{list.error}</Notice>}{(mode === 'offline' || (!list.loading && !list.error)) && pageRows.map((product) => { const low = Number(product.quantity) > 0 && Number(product.quantity) <= Number(product.lowStockLevel); return <article className="catalog-product-card" key={product._id}><div className="catalog-image"><div className="catalog-image-placeholder"><Package size={38} /><span>{product.category || 'PRODUCT'}</span></div><input type="checkbox" checked={selectedRows.includes(product._id)} onChange={() => toggleRow(product._id)} aria-label={`Select ${product.name}`} /><span className="catalog-category">{product.category || 'PRODUCT'}</span></div><div className="catalog-product-body"><div className="catalog-product-title"><strong>{product.brand || 'Product'}</strong><span>{product.location || 'â€”'}</span></div><p className="catalog-model">{product.name}{product.description ? ` Â· Model: ${product.description}` : ''}</p><div className="catalog-stock-row"><span>Quantity<br /><b>{product.quantity} {product.unit || 'pcs'}</b></span><span>Status<br /><b className={product.status === 'ACTIVE' ? (low ? 'text-low' : 'text-in-stock') : 'text-inactive'}>{product.status === 'ACTIVE' ? (Number(product.quantity) === 0 ? 'Out of Stock' : low ? 'Low Stock' : 'In Stock') : 'Inactive'}</b></span></div><div className="catalog-price-row"><span>Price on Sale<br /><b>{money(product.sellingPrice)} RWF</b></span><span>Confirmed<br /><b className="text-confirmed">Yes</b></span></div><div className="catalog-cost-row"><span>Cost Price<br /><b>{money(product.costPrice)} RWF</b></span><span>Total Value<br /><b>{money(Number(product.costPrice || 0) * Number(product.quantity || 0))} RWF</b></span></div></div><div className="catalog-product-actions">{canManageAdmin(auth.user) && <><button type="button" className="catalog-status-button" onClick={() => setStatus(product)}>{product.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button><button title="Edit product" onClick={() => startEdit(product)}><Edit2 size={13} /></button><button title="Duplicate product" onClick={() => duplicate(product)}><Copy size={13} /></button><button title="View product" onClick={() => startEdit(product)}><Eye size={13} /></button></>}<NavLink title="Record sale" to="/transactions/new"><ShoppingCart size={13} /></NavLink>{canManageAdmin(auth.user) && <button title="Delete product" className="delete-action" onClick={() => remove(product)}><Trash2 size={13} /></button>}</div></article> })}{mode === 'offline' && !pageRows.length && <Card className="catalog-state">No saved products found on this device.</Card>}{mode !== 'offline' && !list.loading && !list.error && !pageRows.length && <Card className="catalog-state">No products found.</Card>}</div> : <Card className="recent"><div className="table-wrap"><table className="product-table"><thead><tr>{['Product name','SKU','Category','Brand','Selling price','Cost price','Quantity in stock','Storage location','Status','Actions'].map((col) => <th key={col}>{col}</th>)}</tr></thead><tbody><TableState loading={mode !== 'offline' && list.loading} error={mode === 'offline' ? '' : list.error} empty={!pageRows.length} colSpan={10} />{pageRows.map((product) => <tr key={product._id}><td><strong>{product.name}</strong></td><td>{product.sku || 'â€”'}</td><td>{product.category || 'â€”'}</td><td>{product.brand || 'â€”'}</td><td>{money(product.sellingPrice)} RWF</td><td>{money(product.costPrice)} RWF</td><td>{product.quantity} {product.unit}</td><td>{product.location}</td><td><span className={product.status === 'ACTIVE' ? 'stock-badge active' : 'stock-badge inactive'}>{product.status === 'ACTIVE' ? 'Active' : 'Inactive'}</span>{Number(product.quantity) === 0 ? <span className="stock-badge out">Out of Stock</span> : Number(product.quantity) <= Number(product.lowStockLevel) && <span className="stock-badge low">Low Stock</span>}</td><td>{canManageAdmin(auth.user) && <><button className="row-action" aria-label={product.status === 'ACTIVE' ? 'Deactivate product' : 'Activate product'} title={product.status === 'ACTIVE' ? 'Deactivate product' : 'Activate product'} onClick={() => setStatus(product)}><RotateCcw size={16} /></button><button className="row-action" aria-label="Edit product" onClick={() => startEdit(product)}><Edit2 size={16} /></button><button className="row-action" aria-label="Delete product" onClick={() => remove(product)}><Trash2 size={16} /></button></>}</td></tr>)}</tbody></table></div></Card>}
    <div className="catalog-pagination"><span>Showing {visibleRows.length ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, visibleRows.length)} of {visibleRows.length} products</span><select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}><option value="10">10 per page</option><option value="25">25 per page</option><option value="50">50 per page</option></select><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>â€¹ Previous</button><b>{page}</b><button disabled={page >= pageCount} onClick={() => setPage((value) => value + 1)}>Next â€º</button></div></div></>}
  </div></AppShell>
}

const newSaleLine = () => ({ key: `${Date.now()}-${Math.random()}`, productId: '', search: '', quantity: 1, unitPrice: 0, costPrice: 0, unit: 'â€”' })

function NewTransaction({ auth }) {
  const { t, mode } = useContext(PreferencesContext)
  const sync = useOfflineSync()
  const navigate = useNavigate()
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [items, setItems] = useState([newSaleLine()])
  const [activeSearch, setActiveSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const products = useApi('/products', { params: { refresh }, initial: [] })
  const recent = useApi('/transactions', { params: { limit: 30, refresh }, initial: [], refreshMs: liveRefreshMs })
  const allProducts = mode === 'offline' || !navigator.onLine || products.error
    ? sync.products
    : (products.data || []).map((product) => ({ ...product, quantity: sync.products.find((cached) => String(cached._id || cached.id) === String(product._id))?.quantity ?? product.quantity }))
  const activeProducts = allProducts.filter((product) => product.status === 'ACTIVE')
  useEffect(() => {
    if (recent.data?.length && auth.user) cacheSalesHistory(auth.user._id || auth.user.id, recent.data).then(sync.refreshSnapshot).catch(() => {})
  }, [recent.data, auth.user, sync.refreshSnapshot])
  const historyIds = new Set(sync.snapshot.history.map((row) => String(row._id || row.id)))
  const recentRows = [...sync.snapshot.history, ...(recent.data || []).filter((row) => !historyIds.has(String(row._id)))].sort((left, right) => new Date(right.transactionDate || right.date || right.createdAt) - new Date(left.transactionDate || left.date || left.createdAt)).slice(0, 30)
  const revenue = items.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0), 0)
  const profit = items.reduce((sum, item) => sum + (Number(item.unitPrice || 0) - Number(item.costPrice || 0)) * Number(item.quantity || 0), 0)
  const selectedFor = (item) => allProducts.find((product) => idOf(product) === item.productId)
  const updateItem = (key, change) => setItems((current) => current.map((item) => item.key === key ? { ...item, ...change } : item))
  const quantitiesByProduct = items.reduce((totals, item) => item.productId ? { ...totals, [item.productId]: Number(totals[item.productId] || 0) + Number(item.quantity || 0) } : totals, {})
  const stockError = items.some((item) => !item.productId || selectedFor(item)?.status !== 'ACTIVE' || Number(item.quantity) < 1 || Number(item.quantity) > Number(selectedFor(item)?.quantity || 0)) || Object.entries(quantitiesByProduct).some(([productId, quantity]) => quantity > Number(allProducts.find((product) => idOf(product) === productId)?.quantity || 0))
  const searchResults = (query) => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return []
    return allProducts
      .filter((product) => `${product.name} ${product.sku || ''} ${product.brand || ''} ${product.category || ''}`.toLocaleLowerCase().includes(normalizedQuery))
      .sort((a, b) => Number(!a.name.toLocaleLowerCase().startsWith(normalizedQuery)) - Number(!b.name.toLocaleLowerCase().startsWith(normalizedQuery)) || a.name.localeCompare(b.name))
  }

  const submit = async (event) => {
    event.preventDefault(); setError(''); setMessage('')
    if (stockError) { setError('Choose a product for each line and keep quantities within available stock.'); return }
    setSaving(true)
    try {
      const operationId = crypto.randomUUID()
      await sync.enqueue({ operationId, kind: 'sale', payload: { customerName: customerName.trim() || 'General', paymentMethod, transactionDate: new Date().toISOString(), items: items.map((item) => {
        const product = selectedFor(item)
        return { productId: item.productId, productName: product?.name, sku: product?.sku || '', category: product?.category || '', unitCost: Number(product?.costPrice || 0), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) }
      }) } })
      let successMessage = 'Sale saved on this device and queued for synchronization.'
      if (sync.online) {
        await sync.syncNow()
        const remaining = await offlineDb.operations.get(operationId)
        if (!remaining) successMessage = 'Sale recorded successfully.'
        else if (remaining.status === 'conflict') successMessage = `Sale saved locally but needs review: ${remaining.lastError}`
        else if (remaining.status === 'error') successMessage = `Sale saved locally but needs attention: ${remaining.lastError}`
      }
      setMessage(successMessage)
      setCustomerName(''); setPaymentMethod('CASH'); setItems([newSaleLine()]); setRefresh((value) => value + 1)
    } catch (submitError) { setError(apiMessage(submitError)) } finally { setSaving(false) }
  }

  return <AppShell title="Record Product Sale" auth={auth} saleHeader><div className="page-content sale-page">
    <div className="sale-page-heading"><div><h2>Record Sale</h2><p>Fill in customer and payment type, add items to list, and click Record Sale.</p></div><NavLink to="/sold-products">â† View All Sold Products</NavLink></div>
    {message && <Notice>{message}</Notice>}{error && <Notice tone="error">{error}</Notice>}
    {products.error && sync.products.length === 0 && <Notice tone="error">{products.error || 'Could not load products. Check your connection and try again.'} <button type="button" className="button secondary" onClick={() => setRefresh((value) => value + 1)}>{t('Retry')}</button></Notice>}
    {!products.loading && !products.error && !activeProducts.length && <Notice>No active products are available. Inactive products appear in search but must be activated by an administrator before they can be sold.</Notice>}
    <form onSubmit={submit}>
      <Card className="sale-details-card"><Field label="Customer (Name, Phone, or TIN Number)"><input placeholder="e.g. KEZA ALICIA, 0788123456, or TIN: 700890000" value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></Field><Field label={<>Payment Type<i>*</i></>}><select required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}><option value="CASH">Cash</option><option value="MOMO">Mobile Money</option></select></Field></Card>
      <Card className="sale-items-card"><div className="sale-items-heading"><h3>Sale item list</h3><span>{items.length} Item Line(s)</span></div>
        {items.map((item, index) => {
          const product = selectedFor(item)
          const itemRevenue = Number(item.quantity || 0) * Number(item.unitPrice || 0)
          const itemProfit = Number(item.quantity || 0) * (Number(item.unitPrice || 0) - Number(item.costPrice || 0))
          return <div className="sale-line" key={item.key}><div className="sale-line-number">#{index + 1}</div><label className="sale-product-field"><span>Item name<i>*</i></span><div className="product-search-control"><input required placeholder="Search product by name, code, brand..." value={item.search} onFocus={() => setActiveSearch(item.key)} onChange={(event) => { updateItem(item.key, { search: event.target.value, productId: '' }); setActiveSearch(item.key) }} /><Search size={17} /></div>{activeSearch === item.key && item.search && <div className="sale-product-results">{searchResults(item.search).map((option) => { const inactive = option.status !== 'ACTIVE'; return <button type="button" key={option._id} disabled={inactive} onClick={() => { updateItem(item.key, { productId: option._id, search: option.name, unitPrice: option.sellingPrice, costPrice: option.costPrice || 0, unit: option.unit || 'Pieces (pcs)' }); setActiveSearch('') }}><strong>{option.name}</strong><span>{inactive ? 'Inactive — ask an administrator to activate' : `${option.sku || option.brand || 'Product'} · ${option.quantity} in stock · ${money(option.sellingPrice)} RWF`}</span></button> })}{!searchResults(item.search).length && <p>No matching products.</p>}</div>}</label>
            <div className="sale-line-fields"><Field label="Package"><input readOnly value={product?.unit || item.unit || 'â€”'} /></Field><Field label={<>Quantity<i>*</i></>}><input required min="1" max={product?.quantity} type="number" value={item.quantity} onChange={(event) => updateItem(item.key, { quantity: event.target.value })} /></Field><MoneyField label={<>Unit price<i>*</i></>} required value={item.unitPrice} onChange={(value) => updateItem(item.key, { unitPrice: value })} /></div>
            {product && <div className={Number(item.quantity) > Number(product.quantity) ? 'sale-stock-note error-text' : 'sale-stock-note'}>{Number(item.quantity) > Number(product.quantity) ? `Only ${product.quantity} ${product.unit || 'pcs'} in stock.` : `In stock: ${product.quantity} ${product.unit || 'pcs'} Â· ${product.location}`}</div>}
            <div className="sale-line-totals"><span>Total Revenue: <b>{money(itemRevenue)} RWF</b></span><span>Total Profits: <b>{money(itemProfit)} RWF</b></span>{items.length > 1 && <button type="button" onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}>Remove</button>}</div>
          </div>
        })}
        <div className="sale-add-line"><button type="button" aria-label="Add sale item" onClick={() => setItems((current) => [...current, newSaleLine()])}><Plus size={18} /></button></div>
      </Card>
      <div className="sale-submit-row"><div>TOTAL REVENUE: <b>{money(revenue)} RWF</b><span>Â·</span> TOTAL PROFITS: <b>{money(profit)} RWF</b></div><button type="button" className="button secondary" onClick={() => navigate('/dashboard')}>{t("Cancel")}</button><button className="button" disabled={saving || stockError}>{saving ? 'Recording...' : 'Record Sale'}</button></div>
    </form>
    <Card className="recent sale-recent"><SectionTitle title="Recently Sold Products Data" text="Saved on this device for 90 days." action={<button className="button secondary" onClick={() => setRefresh((value) => value + 1)}>Refresh</button>} /><div className="table-wrap"><table className="sale-history-table"><thead><tr>{['Date','Customer','Product Name','Code','Qty','Unit Price','Total Revenue','Profits','Payment','Sync status'].map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody><TableState loading={recent.loading && sync.online} error={!sync.online ? '' : recent.error} empty={!recentRows.length} colSpan={10} />{recentRows.map((row) => { const soldProduct = row.productId || {}; const unitCost = Number(row.unitCost ?? soldProduct?.costPrice ?? 0); const soldRevenue = Number(row.totalAmount || row.unitPrice * row.quantity || 0); const soldProfit = soldRevenue - unitCost * Number(row.quantity || 1); return <tr key={row._id || row.id}><td>{new Date(row.transactionDate || row.date || row.createdAt).toLocaleString()}</td><td>{row.customerName || 'General'}</td><td><strong>{soldProduct?.name || row.serviceOrProduct}</strong></td><td>{soldProduct?.sku || 'â€”'}</td><td>{row.quantity || 1}</td><td>{money(row.unitPrice)} RWF</td><td>{money(soldRevenue)} RWF</td><td className="profit-value">{money(soldProfit)} RWF</td><td>{row.paymentMethod === 'MOMO' ? 'Mobile Money' : 'Cash'}</td><td>{row.status === 'pending' ? 'Pending' : row.status === 'conflict' ? 'Conflict' : row.status === 'error' ? 'Needs attention' : 'Synced'}</td></tr> })}</tbody></table></div></Card>
  </div></AppShell>
}

function Field({ label, children }) {
  const { t } = useContext(PreferencesContext)
  return <label><span>{localizeNode(label, t)}</span>{localizeNode(children, t)}</label>
}

function ProductChoice({ label, value, options, onChange, required = false, wide = false }) {
  const { t } = useContext(PreferencesContext)
  return <div className={'product-choice' + (wide ? ' wide' : '')}>
    <div className="product-choice-heading"><span>{t(label)}{required && <> <i>*</i></>}</span></div>
    <select required={required} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{t('Select')} {t(label.toLowerCase())}</option>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </div>
}

function MoneyField({ label, value, onChange, required = false, placeholder = '0' }) {
  const { t } = useContext(PreferencesContext)
  return <label className="money-field"><span>{localizeNode(label, t)}</span><div><b>RWF</b><input required={required} min="0" type="number" placeholder={t(placeholder)} value={value} onChange={(event) => onChange(event.target.value)} /></div></label>
}

function Select({ value, onChange }) {
  const { t } = useContext(PreferencesContext)
  return <select required value={value} onChange={(e) => onChange(e.target.value)}><option value="MOMO">{t("MoMo Pay")}</option><option value="CASH">{t("Cash")}</option></select>
}

function Hero({ title, text, action, actionText }) {
  const { t } = useContext(PreferencesContext)
  return <Card className="page-hero"><div><p className="eyebrow">{t('MANAGEMENT')}</p><h2>{t(title)}</h2><p>{t(text)}</p></div>{action && <div className="hero-buttons"><NavLink className="button" to={action}><Plus size={17} /> {t(actionText)}</NavLink></div>}</Card>
}

function ReportsPage({ auth }) {
  const [range, setRange] = useState({ fromDate: today, toDate: today })
  const [refresh, setRefresh] = useState(0)
  const [selectedUser, setSelectedUser] = useState('')
  const isAdmin = canManageAdmin(auth.user)
  const users = useApi('/users', { initial: [], enabled: isAdmin })
  const reportParams = Object.fromEntries(Object.entries(range).filter(([, value]) => value))
  if (isAdmin && selectedUser) reportParams.userId = selectedUser
  reportParams.refresh = refresh
  const report = useApi('/reports/sales', { params: reportParams, initial: { transactions: [], paymentMethods: {} }, refreshMs: liveRefreshMs })
  const data = report.data || {}
  const downloadReport = async () => {
    const downloadParams = Object.fromEntries(Object.entries(range).filter(([, value]) => value))
    if (isAdmin && selectedUser) downloadParams.userId = selectedUser
    const params = new URLSearchParams(downloadParams).toString()
    const response = await fetch(`${API_BASE_URL}/reports/sales/pdf?${params}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('shop_report_token')}` },
    })
    const blob = await response.blob()
    window.open(URL.createObjectURL(blob), '_blank')
  }

  return <AppShell title="Reports" auth={auth}><div className="page-content">
    <Card className="page-hero"><div><p className="eyebrow">REPORTING</p><h2>Sales performance</h2><p>Review recorded sales and payment activity for the selected period.</p></div><div className="hero-buttons"><button className="button" onClick={downloadReport}>Download report</button></div></Card>
    <DateControls range={range} setRange={setRange} compact onSearch={() => setRefresh((value) => value + 1)} />
    {isAdmin && <Card className="report-filter"><label htmlFor="sales-user-filter">Salesperson</label><select id="sales-user-filter" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}><option value="">All users</option>{(users.data || []).map((user) => <option key={user._id || user.id} value={user._id || user.id}>{user.fullName || user.name} · {user.role}{user.status === 'INACTIVE' ? ' (inactive)' : ''}</option>)}</select></Card>}
    <div className="stat-grid report-stats">{[
      ['Total sales', data.totalAmount ?? data.totalPaid], ['Transactions', data.totalTransactions], ['Cash out', data.totalCashOut], ['Cash in', data.totalCashIn ?? data.totalMoneyEarned], ['Outstanding', data.totalRemainingMoney ?? data.totalRemaining],
    ].map(([label, value]) => <Card className="stat-card" key={label}><p>{label}</p><h2>{money(value)}{label === 'Transactions' ? <small> sales</small> : <small> RWF</small>}</h2></Card>)}</div>
    {isAdmin && <Card className="recent report-user-summary"><SectionTitle title="Sales by user" text={selectedUser ? 'Showing this user’s sales for the selected period' : 'Compare each team member’s sales for the selected period'} /><div className="table-wrap report-user-table"><table className="simple-table"><thead><tr><th>User</th><th>Transactions</th><th>Sales</th><th>Cash out</th><th>Cash in</th></tr></thead><tbody>{(data.salesByUser || []).length ? data.salesByUser.map((item) => <tr key={item.userId || item.name}><td><strong>{item.name}</strong></td><td>{item.transactions}</td><td>{money(item.sales)} RWF</td><td>{money(item.cashOut)} RWF</td><td>{money(item.cashIn)} RWF</td></tr>) : <tr><td colSpan="5" className="empty-cell">No sales for this user in this period.</td></tr>}</tbody></table></div><div className="report-user-cards">{(data.salesByUser || []).length ? data.salesByUser.map((item) => <article className="report-user-card" key={item.userId || item.name}><div><strong>{item.name}</strong><span>{item.transactions} {item.transactions === 1 ? 'transaction' : 'transactions'}</span></div><b>{money(item.sales)} <small>RWF sales</small></b><dl><div><dt>Cash out</dt><dd>{money(item.cashOut)} RWF</dd></div><div><dt>Cash in</dt><dd>{money(item.cashIn)} RWF</dd></div></dl></article>) : <p className="report-user-empty">No sales for this user in this period.</p>}</div></Card>}
    <Card className="recent"><SectionTitle title="Best-selling products" text="Ranked by quantity sold in the selected period" /><div className="table-wrap"><table className="simple-table"><thead><tr><th>Product</th><th>SKU</th><th>Quantity sold</th><th>Sales</th></tr></thead><tbody>{(data.bestSellingProducts || []).length ? data.bestSellingProducts.map((item) => <tr key={item.productId}><td><strong>{item.name}</strong></td><td>{item.sku || 'â€”'}</td><td>{item.quantitySold}</td><td>{money(item.sales)} RWF</td></tr>) : <tr><td colSpan="4" className="empty-cell">No product sales for this period.</td></tr>}</tbody></table></div></Card>
    <Card className="recent"><SectionTitle title="Sales transactions" text="Recorded sales for the selected date range" /><TransactionTable rows={data.transactions || []} loading={report.loading} error={report.error} /></Card>
  </div></AppShell>
}

function ResourcePage({ auth, type, title }) {
  const { t } = useContext(PreferencesContext)
  const sync = useOfflineSync()
  const endpoints = {
    expenses: '/expenses',
    users: '/users',
    logs: '/activity-logs',
  }
  const resource = useApi(endpoints[type], { initial: [] })
  const [form, setForm] = useState({})
  const [addingRow, setAddingRow] = useState(false)
  const [rowDraft, setRowDraft] = useState(emptyStock)
  const [editingId, setEditingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [refresh, setRefresh] = useState(0)
  const [range, setRange] = useState({ fromDate: today, toDate: today })
  const params = type === 'expenses' ? { ...range, refresh } : { refresh }
  const list = useApi(endpoints[type], { params, initial: [], refreshMs: type === 'expenses' ? liveRefreshMs : 0 })
  const data = type === 'logs' ? resource.data : list.data

  const submit = async (event) => {
    event.preventDefault(); setSaving(true); setMessage(''); setError('')
    try {
      if (editingId) await api.put(`${endpoints[type]}/${editingId}`, normalizeForm(type, form, true))
      else await api.post(endpoints[type], normalizeForm(type, form))
      setForm({})
      setEditingId('')
      setRefresh((x) => x + 1)
      setMessage(editingId ? 'Saved successfully.' : 'Created successfully.')
    } catch (error) {
      setError(apiMessage(error))
    } finally {
      setSaving(false)
    }
  }
  const edit = (row) => {
    if (type !== 'users') return
    setEditingId(row._id)
    setForm({ name: row.fullName || row.name || '', phoneNumber: row.phoneNumber || '', role: row.role || 'STAFF', status: row.status || 'ACTIVE' })
  }
  const remove = async (id) => {
    setMessage(''); setError('')
    try {
      await api.delete(`${endpoints[type]}/${id}`)
      setRefresh((x) => x + 1)
      setMessage('Deleted successfully.')
    } catch (error) {
      setError(apiMessage(error))
    }
  }
  const saveStockRow = async () => {
    setSaving(true); setMessage(''); setError('')
    try {
      const data = normalizeForm(type, rowDraft)
      if (!data.productId && !sync.online) throw new Error('Choose a product to import stock while offline.')
      if (data.productId && data.stockQuantity > 0) {
        const operationId = crypto.randomUUID()
        await sync.enqueue({ operationId, kind: 'import', payload: { ...data, expenseDate: new Date().toISOString() } })
        if (sync.online) await sync.syncNow()
        const remaining = await offlineDb.operations.get(operationId)
        setMessage(!remaining ? 'Imported stock saved and synchronized.' : remaining.status === 'conflict' ? `Import saved locally but needs review: ${remaining.lastError}` : 'Imported stock saved on this device and queued for synchronization.')
      } else {
        if (!sync.online) throw new Error('Offline imports need a product and a quantity greater than zero.')
        await api.post(endpoints[type], data)
        setMessage('Imported stock saved.')
      }
      setRowDraft(emptyStock)
      setAddingRow(false)
      setRefresh((x) => x + 1)
    } catch (error) {
      setError(apiMessage(error))
    } finally {
      setSaving(false)
    }
  }
  const updateStockRow = async (id, stock) => {
    setMessage(''); setError('')
    try {
      await api.put(`${endpoints[type]}/${id}`, normalizeForm(type, stock))
      setRefresh((x) => x + 1)
      setMessage('Imported stock updated.')
    } catch (error) {
      setError(apiMessage(error))
      throw error
    }
  }
  const downloadStockReport = async () => {
    const params = new URLSearchParams(range).toString()
    const response = await fetch(`${API_BASE_URL}/reports/imported-stock/pdf?${params}`, {
      headers: { Authorization: `Bearer ${sessionStorage.getItem('shop_report_token')}` },
    })
    const blob = await response.blob()
    window.open(URL.createObjectURL(blob), '_blank')
  }

  return <AppShell title={title} auth={auth}><div className="page-content">
    {type === 'expenses' ? <Card className="page-hero"><div><p className="eyebrow">MANAGEMENT</p><h2>{title}</h2><p>Imported stock by selected date.</p></div><div className="hero-buttons"><button className="button" onClick={downloadStockReport}>Download report</button></div></Card> : <Hero title={title} text={type === 'logs' ? 'Review team activity across the system.' : `Manage ${title.toLowerCase()} from the live database.`} />}
    {type === 'expenses' && <DateControls range={range} setRange={setRange} compact onSearch={() => setRefresh((value) => value + 1)} />}
    {message && <Notice>{message}</Notice>}{error && <Notice tone="error">{error}</Notice>}
    {type === 'expenses' && canManageAdmin(auth.user) && sync.snapshot.operations.some((operation) => operation.kind === 'import') && <Card className="recent offline-import-queue"><SectionTitle title="Offline imports" text="Queued imports are kept on this device until confirmed by the server." /><div className="table-wrap"><table><thead><tr><th>Product</th><th>Quantity</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>{sync.snapshot.operations.filter((operation) => operation.kind === 'import').map((operation) => { const product = sync.products.find((row) => String(row._id || row.id) === String(operation.payload.productId)); return <tr key={operation.operationId}><td>{product?.name || 'Product'}</td><td>{operation.payload.stockQuantity}</td><td>{operation.payload.description}</td><td>{money(operation.payload.amount)} RWF</td><td>{operation.status === 'pending' ? 'Pending sync' : operation.status === 'conflict' ? 'Conflict' : 'Needs attention'}</td></tr> })}</tbody></table></div></Card>}
    {type === 'users' && <Card className="form-card compact-form"><SectionTitle title={editingId ? 'Edit user' : 'Add user'} text="Create an account with a name, phone number, and password." /><form onSubmit={submit}><ResourceFields type={type} form={form} setForm={setForm} editing={Boolean(editingId)} /><div className="form-actions">{editingId && <button type="button" className="button secondary" onClick={() => { setEditingId(''); setForm({}) }}>Cancel edit</button>}<button className="button" disabled={saving}>{saving ? t("Saving...") : t("Save")}</button></div></form></Card>}
    <Card className="recent"><SectionTitle title={`All ${title.toLowerCase()}`} text={type === 'expenses' ? 'Stock received and inventory purchases' : 'Live records from MongoDB'} action={type === 'expenses' && canManageAdmin(auth.user) && <button className="button" onClick={() => setAddingRow(true)}><Plus size={16} /> Add stock</button>} /><ResourceTable type={type} rows={data || []} loading={(type === 'logs' ? resource : list).loading} error={(type === 'logs' ? resource : list).error} onDelete={type === 'expenses' && !canManageAdmin(auth.user) ? undefined : remove} onEdit={type === 'expenses' ? undefined : edit} onUpdate={type === 'expenses' && canManageAdmin(auth.user) ? updateStockRow : undefined} adding={addingRow} draft={rowDraft} setDraft={setRowDraft} onSave={saveStockRow} onCancel={() => { setAddingRow(false); setRowDraft(emptyStock) }} saving={saving} currentUser={auth.user} /></Card>
  </div></AppShell>
}

function normalizeForm(type, form) {
  if (type === 'expenses') return { description: form.description, amount: Number(form.amount || 0), paymentMethod: form.paymentMethod || 'CASH', productId: form.productId || undefined, stockQuantity: Number(form.stockQuantity || 0) }
  const data = { name: form.name, phoneNumber: form.phoneNumber, role: form.role || 'STAFF', status: form.status || 'ACTIVE' }
  if (form.password) data.password = form.password
  return data
}

function ResourceFields({ type, form, setForm, editing = false }) {
  const set = (key, value) => setForm({ ...form, [key]: value })
  if (type === 'expenses') return <div className="form-grid"><Field label="Description"><input required value={form.description || ''} onChange={(e) => set('description', e.target.value)} /></Field><Field label="Amount"><input required type="number" min="1" value={form.amount || ''} onChange={(e) => set('amount', e.target.value)} /></Field><Field label="Payment method"><Select value={form.paymentMethod || 'CASH'} onChange={(v) => set('paymentMethod', v)} /></Field></div>
  return <div className="form-grid"><Field label="Name"><input required value={form.name || ''} onChange={(e) => set('name', e.target.value)} /></Field><Field label="Phone number"><input required inputMode="numeric" value={form.phoneNumber || ''} onChange={(e) => set('phoneNumber', e.target.value.replace(/\D/g, '').slice(0, 10))} /></Field><Field label={editing ? 'Reset password (optional)' : 'Password'}><input type="password" required={!editing} minLength="8" maxLength="128" value={form.password || ''} onChange={(e) => set('password', e.target.value)} /></Field><Field label="Role"><select required value={form.role || 'STAFF'} onChange={(e) => set('role', e.target.value)}><option value="MANAGER">Manager</option><option value="STAFF">Staff</option><option value="CASHIER">Cashier</option></select></Field><Field label="Account status"><select value={form.status || 'ACTIVE'} onChange={(e) => set('status', e.target.value)}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></Field></div>
}

function ResourceTable({ type, rows = [], loading, error, onDelete, onEdit, onUpdate, adding = false, draft = emptyStock, setDraft, onSave, onCancel, saving = false, currentUser }) {
  const { t } = useContext(PreferencesContext)
  const offlineSync = useOfflineSync()
  const [editingId, setEditingId] = useState('')
  const [editDraft, setEditDraft] = useState(emptyStock)
  const [editing, setEditing] = useState(false)
  const products = useApi('/products', { params: { status: 'ACTIVE' }, initial: [], enabled: type === 'expenses' })
  const productOptions = products.data?.length
    ? products.data.map((product) => ({ ...product, quantity: offlineSync.products.find((cached) => String(cached._id || cached.id) === String(product._id))?.quantity ?? product.quantity }))
    : offlineSync.products
  const cols = {
    expenses: ['Date', 'User', 'Product', 'Quantity', 'What imported', 'Amount', 'Payment method'],
    users: ['Name', 'Phone number', 'Role', 'Status'],
    logs: ['Action', 'Description', 'User', 'Time'],
  }[type]
  const stockTotal = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  const startStockEdit = (row) => {
    setEditingId(row._id)
    setEditDraft({ description: row.description || '', amount: row.amount ?? '', paymentMethod: row.paymentMethod || 'CASH', productId: idOf(row.productId), stockQuantity: row.stockQuantity ?? '' })
  }
  const saveStockEdit = async () => {
    setEditing(true)
    try {
      await onUpdate?.(editingId, editDraft)
      setEditingId('')
      setEditDraft(emptyStock)
    } finally {
      setEditing(false)
    }
  }
  return <div className="table-wrap"><table className={`resource-table resource-${type}`}><thead><tr>{cols.map((c) => <th key={c}>{t(c)}</th>)}<th></th></tr></thead><tbody>
    {type === 'expenses' && adding && <tr className="inline-row">
      <td>{t("Today")}</td>
      <td>{t("Me")}</td>
      <td><select value={draft.productId || ''} onChange={(e) => setDraft({ ...draft, productId: e.target.value })}><option value="">Unlinked import</option>{productOptions.map((product) => <option key={product._id || product.id} value={product._id || product.id}>{product.name}</option>)}</select></td>
      <td><input min="0" type="number" value={draft.stockQuantity || ''} onChange={(e) => setDraft({ ...draft, stockQuantity: e.target.value })} placeholder="0" /></td>
      <td><input required value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Imported item" /></td>
      <td><input required min="1" type="number" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} placeholder="0" /></td>
      <td><Select value={draft.paymentMethod} onChange={(paymentMethod) => setDraft({ ...draft, paymentMethod })} /></td>
      <td className="row-buttons"><button className="button" onClick={onSave} disabled={saving}>{saving ? t("Saving...") : t("Save")}</button><button className="button secondary" onClick={onCancel}>{t("Cancel")}</button></td>
    </tr>}
    <TableState loading={loading} error={error} empty={!rows.length && !adding} colSpan={cols.length + 1} />
    {rows.map((row) => type === 'expenses' && editingId === row._id ? <tr key={row._id} className="inline-row">
      <td>{new Date(row.expenseDate || row.date || row.createdAt).toLocaleDateString()}</td>
      <td>{row.createdBy?.fullName || row.createdBy?.name || '-'}</td>
      <td><select value={editDraft.productId || ''} onChange={(e) => setEditDraft({ ...editDraft, productId: e.target.value })}><option value="">Unlinked import</option>{productOptions.map((product) => <option key={product._id || product.id} value={product._id || product.id}>{product.name}</option>)}</select></td>
      <td><input min="0" type="number" value={editDraft.stockQuantity || ''} onChange={(e) => setEditDraft({ ...editDraft, stockQuantity: e.target.value })} /></td>
      <td><input required value={editDraft.description} onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })} /></td>
      <td><input required min="1" type="number" value={editDraft.amount} onChange={(e) => setEditDraft({ ...editDraft, amount: e.target.value })} /></td>
      <td><Select value={editDraft.paymentMethod} onChange={(paymentMethod) => setEditDraft({ ...editDraft, paymentMethod })} /></td>
      <td className="row-buttons"><button className="button" onClick={saveStockEdit} disabled={editing}>{editing ? t("Saving...") : t("Save")}</button><button className="button secondary" onClick={() => setEditingId('')}>{t("Cancel")}</button></td>
    </tr> : <tr key={row._id}>{resourceCells(type, row, t).map((cell, i) => <td key={i}>{cell}</td>)}<td>{type === 'expenses' && onUpdate && isOwnRow(row, currentUser) && <button className="row-action" onClick={() => startStockEdit(row)}><Edit2 size={16} /></button>}{type === 'users' && onEdit && !['ADMIN', 'OWNER'].includes(row.role) && <button className="row-action" onClick={() => onEdit(row)}><Edit2 size={16} /></button>}{type !== 'logs' && onDelete && (type !== 'expenses' || isOwnRow(row, currentUser)) && (type !== 'users' || !['ADMIN', 'OWNER'].includes(row.role)) && <button className="row-action" onClick={() => confirmDelete() && onDelete(row._id)}><Trash2 size={16} /></button>}</td></tr>)}
    {type === 'expenses' && <tr className="total-row"><td colSpan="5">Total</td><td>{money(stockTotal)} <small>RWF</small></td><td colSpan="2"></td></tr>}
  </tbody></table></div>
}

function resourceCells(type, row, t) {
  if (type === 'expenses') return [new Date(row.expenseDate || row.date || row.createdAt).toLocaleDateString(), row.createdBy?.fullName || row.createdBy?.name || '-', row.productId?.name || '-', row.stockQuantity || 0, <strong key="description">{row.description}</strong>, `${money(row.amount)} RWF`, row.paymentMethod === 'MOMO' ? t('MoMo Pay') : t('Cash')]
  if (type === 'users') return [<strong key="name">{row.fullName || row.name}</strong>, row.phoneNumber || '-', row.role, row.status]
  return [row.action, row.description, row.user?.fullName || row.user?.name || '-', new Date(row.timestamp).toLocaleString()]
}

function Protected({ auth, children }) {
  const onlineSession = Boolean(sessionStorage.getItem('shop_report_token'))
  return auth.user && (onlineSession || auth.offline) ? children : <Navigate to="/login" replace />
}

function WorkspaceInfoPage({ auth, title, description }) {
  const { language, theme, mode, setLanguage, setTheme, setMode, t } = useContext(PreferencesContext)
  const isAccount = title === 'Account Information'
  const isSettings = title === 'Settings'
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const fullName = auth.user?.fullName || auth.user?.name || ''
  const [firstName, ...lastParts] = fullName.trim().split(/\s+/)
  const lastName = lastParts.join(' ')
  const changePassword = async (event) => {
    event.preventDefault()
    setPasswordMessage('')
    setPasswordError('')
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match.')
      return
    }
    setPasswordSaving(true)
    try {
      const { data } = await api.post('/auth/change-password', passwordForm)
      setPasswordMessage(data.message || 'Password updated successfully.')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      setPasswordError(apiMessage(error))
    } finally {
      setPasswordSaving(false)
    }
  }
  return <AppShell title={title} auth={auth}><div className={'page-content' + (isAccount ? ' account-page-content' : '')}>{isAccount ? <>
    <div className="account-page-heading"><div><h2>Account Information</h2><p>View and update your profile details and settings.</p></div><button type="button" className="button account-edit-button"><Pencil size={13} /> Edit</button></div>
    <Card className="account-panel"><div className="account-profile"><div className="account-avatar-wrap"><div className="account-avatar"><CircleUserRound size={43} /></div><span>AVATAR</span></div><div className="account-details"><div><small>FIRST NAME</small><span>{firstName || 'â€”'}</span><small>GENDER</small><span>{auth.user?.gender || 'â€”'}</span><small>PHONE</small><span>{auth.user?.phoneNumber ? `+250${auth.user.phoneNumber.replace(/^0/, '')}` : 'â€”'}</span></div><div><small>LAST NAME</small><span>{lastName || 'â€”'}</span><small>EMAIL</small><span>{auth.user?.email || 'â€”'}</span><small>ROLE</small><span>{auth.user?.role || 'â€”'}</span></div></div></div>
      <section className="account-password"><h3><LockKeyhole size={15} /> Change Password</h3>{passwordMessage && <Notice>{passwordMessage}</Notice>}{passwordError && <Notice tone="error">{passwordError}</Notice>}<form onSubmit={changePassword}><label>CURRENT PASSWORD<input required type="password" placeholder="Enter current password" autoComplete="current-password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm({ ...passwordForm, currentPassword: event.target.value })} /></label><label>NEW PASSWORD<input required minLength={8} maxLength={128} type="password" placeholder="Enter new password" autoComplete="new-password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm({ ...passwordForm, newPassword: event.target.value })} /></label><label>CONFIRM NEW PASSWORD<input required minLength={8} maxLength={128} type="password" placeholder="Confirm new password" autoComplete="new-password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm({ ...passwordForm, confirmPassword: event.target.value })} /></label><button type="submit" className="button" disabled={passwordSaving}>{passwordSaving ? 'Updating...' : 'Update password'}</button></form></section>
    </Card></> : <><Card className="page-hero"><div><p className="eyebrow">WORKSPACE</p><h2>{t(title)}</h2><p>{description}</p></div></Card>
    {<Card className="form-card workspace-info">{isSettings ? <><SectionTitle title={t("Shop settings")} text={t("Review workspace preferences.")} /><div className="settings-preferences"><label>{t("Language")}<select value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">{t("English")}</option><option value="rw">{t("Kinyarwanda")}</option></select></label><label>{t("Appearance")}<select value={theme} onChange={(event) => setTheme(event.target.value)}><option value="light">{t("Light")}</option><option value="dark">{t("Dark")}</option></select></label><label>{t("Operating mode")}<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="online">{t("Online mode")}</option><option value="offline">{t("Offline mode")}</option></select><small>{t(mode === 'offline' ? 'Offline mode uses saved data. Sales and stock imports queue for sync; other records are view-only.' : 'Online mode uses live server data and synchronizes queued offline sales and imports.')}</small></label></div><PwaInstallSetting t={t} /><dl><dt>{t("Currency")}</dt><dd>RWF</dd><dt>{t("Workspace")}</dt><dd>manageyourstock</dd></dl></> : <></>}</Card>}
    </>}
  </div></AppShell>
}

function PwaInstallSetting({ t }) {
  const [installPrompt, setInstallPrompt] = useState(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [isInstalled, setIsInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true)

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)')
    const updateInstalledState = () => setIsInstalled(displayMode.matches || navigator.standalone === true)
    const handleInstallAvailable = () => setInstallPrompt(deferredPwaInstallPrompt)
    const handleInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    }
    setInstallPrompt(deferredPwaInstallPrompt)
    displayMode.addEventListener?.('change', updateInstalledState)
    displayMode.addListener?.(updateInstalledState)
    window.addEventListener('manageyourstockinstallavailable', handleInstallAvailable)
    window.addEventListener('appinstalled', handleInstalled)
    return () => {
      displayMode.removeEventListener?.('change', updateInstalledState)
      displayMode.removeListener?.(updateInstalledState)
      window.removeEventListener('manageyourstockinstallavailable', handleInstallAvailable)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  const handleClick = async () => {
    if (isInstalled) {
      setHelpOpen((open) => !open)
      return
    }
    if (!installPrompt) {
      setHelpOpen(true)
      return
    }
    try {
      await installPrompt.prompt()
      const choice = await installPrompt.userChoice
      if (choice?.outcome === 'accepted') setIsInstalled(true)
      deferredPwaInstallPrompt = null
      setInstallPrompt(null)
    } catch {
      setHelpOpen(true)
    }
  }

  const installedInstructions = 'Your device controls app removal. On Windows, open Start, find manageyourstock, right-click it, and choose Uninstall. On Android, long-press its icon and choose App info, then Uninstall. On iPhone or iPad, touch and hold its icon, then choose Remove App.'
  const installInstructions = installPrompt
    ? 'Use your browser’s install option to add the app to this device.'
    : 'On iPhone or iPad, open the browser Share menu and choose Add to Home Screen. On other devices, use the browser menu and choose Install app or Add to Home Screen.'

  return <section className="pwa-install-setting" aria-label={t('App installation status')}>
    <div className="pwa-install-copy"><strong>{t('Install manageyourstock on this device')}</strong><span>{isInstalled ? t('App installed') : t('Use your browser’s install option to add the app to this device.')}</span></div>
    <button type="button" className={isInstalled ? 'button secondary' : 'button'} onClick={handleClick}>{t(isInstalled ? 'Uninstall app' : 'Install app')}</button>
    {helpOpen && <div className="pwa-install-help" role="status"><p>{t(isInstalled ? installedInstructions : installInstructions)}</p><button type="button" className="button secondary" onClick={() => setHelpOpen(false)}>{t('Close')}</button></div>}
  </section>
}


function RoleProtected({ auth, admin = false, business = false, children }) {
  if (admin && !canManageAdmin(auth.user)) return <Navigate to="/dashboard" replace />
  if (business && !canManageBusiness(auth.user)) return <Navigate to="/dashboard" replace />
  return children
}

function AppRoutes() {
  const auth = useAuth()
  const [preferences, setPreferences] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('shop_report_preferences') || '{}'); return { theme: ['light', 'dark'].includes(saved.theme) ? saved.theme : 'light', language: ['en', 'rw'].includes(saved.language) ? saved.language : 'en', mode: ['online', 'offline'].includes(saved.mode) ? saved.mode : 'online' } } catch { return { theme: 'light', language: 'en', mode: 'online' } }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme
    document.documentElement.lang = preferences.language
    localStorage.setItem('shop_report_preferences', JSON.stringify(preferences))
  }, [preferences])
  const t = (text) => translations[preferences.language]?.[text] || text
  const preferenceValue = { ...preferences, setTheme: (theme) => setPreferences((current) => ({ ...current, theme })), setLanguage: (language) => setPreferences((current) => ({ ...current, language })), setMode: (mode) => setPreferences((current) => ({ ...current, mode })), t }
  const protect = (children) => <Protected auth={auth}>{children}</Protected>
  if (auth.lockedAccount && !auth.showOnlineLogin && !auth.user) return <PreferencesContext.Provider value={preferenceValue}><OfflineUnlock auth={auth} /></PreferencesContext.Provider>
  return <OfflineSyncProvider user={auth.user} reauthenticate={auth.reauthenticate}><PreferencesContext.Provider value={preferenceValue}><Routes>
    <Route index element={<Navigate to="/dashboard" replace />} />
    <Route path="/login" element={<Login auth={auth} />} />
    <Route path="/dashboard" element={protect(<Dashboard auth={auth} />)} />
    <Route path="/transactions/new" element={protect(<NewTransaction auth={auth} />)} />
    <Route path="/transactions" element={protect(<TransactionsPage auth={auth} />)} />
    <Route path="/sold-products" element={protect(<SoldProductsPage auth={auth} />)} />
    <Route path="/products" element={protect(<ProductsPage auth={auth} />)} />
    <Route path="/products/new" element={protect(<RoleProtected auth={auth} admin><ProductsPage auth={auth} initialAdd /></RoleProtected>)} />
    <Route path="/reports" element={protect(<ReportsPage auth={auth} />)} />
    <Route path="/expenses" element={protect(<ResourcePage auth={auth} type="expenses" title="Imported stock" />)} />
    <Route path="/account" element={protect(<WorkspaceInfoPage auth={auth} title="Account Information" description="Review your user account details." />)} />
    <Route path="/settings" element={protect(<WorkspaceInfoPage auth={auth} title="Settings" description="Review workspace preferences." />)} />
    <Route path="/users" element={protect(<RoleProtected auth={auth} admin><ResourcePage auth={auth} type="users" title="Users management" /></RoleProtected>)} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes></PreferencesContext.Provider></OfflineSyncProvider>
}

function App() {
  return <HashRouter><AppRoutes /></HashRouter>
}

export default App








