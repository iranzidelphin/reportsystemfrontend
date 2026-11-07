export const PRODUCT_FIELD_DEFINITIONS = [
  ['name', 'Product name', 'Product information', true], ['category', 'Category', 'Product information'], ['brand', 'Brand', 'Product information'], ['model', 'Model', 'Product information'],
  ['track', 'Track stock', 'Stock and pricing', true], ['unit', 'Sold by (unit)', 'Stock and pricing', true], ['qty', 'Quantity', 'Stock and pricing'], ['pkg', 'Package', 'Stock and pricing'], ['buy', 'Purchase price', 'Stock and pricing'], ['est', 'Estimated cost per unit', 'Stock and pricing'], ['sell', 'Selling price (per unit)', 'Stock and pricing', true], ['psell', 'Package selling price', 'Stock and pricing'], ['exp', 'Expiry date', 'Stock and pricing'], ['low', 'Low-stock level', 'Stock and pricing'],
  ['loc', 'Storage location', 'Storage and supplier'], ['sup', 'Supplier', 'Storage and supplier'],
]
export const FIELD_CATALOG = Object.fromEntries(PRODUCT_FIELD_DEFINITIONS.map(([key, label, group, locked]) => [key, { key, defaultLabel: label, group, locked: Boolean(locked), input: ['qty', 'pkg', 'buy', 'est', 'sell', 'psell', 'low'].includes(key) ? 'number' : key === 'exp' ? 'date' : key === 'track' ? 'checkbox' : ['category', 'brand', 'model', 'unit', 'buy'].includes(key) ? 'select' : 'text' }]))

export const PRODUCT_PRESETS = {
  electronics: { label: 'Electronics shop', visible: ['name', 'category', 'brand', 'model', 'track', 'unit', 'qty', 'buy', 'sell', 'low', 'loc', 'sup'], required: ['name', 'unit', 'category', 'brand', 'model', 'buy', 'sell', 'loc'] },
  bar: { label: 'Bar', visible: ['name', 'category', 'brand', 'model', 'track', 'unit', 'qty', 'pkg', 'buy', 'sell', 'psell', 'exp', 'low', 'loc', 'sup'], required: ['name', 'unit', 'category', 'buy', 'sell', 'loc'], labels: { model: 'Size' } },
  restaurant: { label: 'Restaurant / café', visible: ['name', 'category', 'track', 'unit', 'qty', 'pkg', 'buy', 'est', 'sell', 'psell', 'exp', 'low'], required: ['name', 'unit', 'category', 'sell'] },
}

export function createProductFieldConfig(preset = 'bar') {
  const source = PRODUCT_PRESETS[preset] || PRODUCT_PRESETS.bar
  return Object.fromEntries(PRODUCT_FIELD_DEFINITIONS.map(([key, label, _section, locked]) => [key, { label: source.labels?.[key] || label, show: locked || source.visible.includes(key), required: key === 'track' ? false : locked || source.required.includes(key) }]))
}

export function isFieldVisible(key, fields, trackStock = true) {
  if (!fields?.[key]?.show) return false
  if (['qty', 'buy', 'pkg', 'low'].includes(key)) return trackStock
  if (key === 'psell') return trackStock && Boolean(fields?.pkg?.show)
  if (key === 'est') return !trackStock
  return true
}

export function getVisibleFields(config = {}, values = {}) {
  const fields = config.fields || config
  const trackStock = values.trackStock !== false
  return ['Product information', 'Stock and pricing', 'Storage and supplier'].map((group) => ({ group, fields: PRODUCT_FIELD_DEFINITIONS.filter(([key, , itemGroup]) => itemGroup === group && isFieldVisible(key, fields, trackStock)).map(([key, defaultLabel]) => ({ ...FIELD_CATALOG[key], label: fields[key]?.label || defaultLabel, required: Boolean(fields[key]?.required) })) })).filter((group) => group.fields.length)
}

export const productFieldValue = (key, values) => ({ name: values.name, category: values.category, brand: values.brand, model: values.model, track: values.trackStock, unit: values.unit, qty: values.quantity, pkg: values.packageName, buy: values.buyPrice ?? values.costPrice, est: values.estimatedCost ?? values.estimatedCostPerUnit, sell: values.sellPrice ?? values.sellingPrice, psell: values.packageSellPrice ?? values.packageSellingPrice, exp: values.expiryDate, low: values.lowStockLevel, loc: values.location, sup: values.supplier }[key])

export function validateProduct(config, values) {
  const errors = {}
  for (const group of getVisibleFields(config, values)) for (const field of group.fields) {
    const value = productFieldValue(field.key, values)
    if (field.required && (value === '' || value === null || value === undefined)) errors[field.key] = `${field.label} is required`
    if (['qty', 'low', 'pkg'].includes(field.key) && value !== '' && value != null && (!Number.isInteger(Number(value)) || Number(value) < (field.key === 'pkg' ? 1 : 0))) errors[field.key] = `${field.label} must be a valid whole number`
    if (['buy', 'est', 'sell', 'psell'].includes(field.key) && value !== '' && value != null && Number(value) < 0) errors[field.key] = `${field.label} must be zero or more`
  }
  return { valid: !Object.keys(errors).length, errors }
}

export function productCalculations({ trackStock = true, buyBasis = 'unit', purchasePrice = 0, estimatedCost = 0, quantity = 0, packageSize = 1, packagePrice = 0, sellingPrice = 0, packageVisible = false } = {}) {
  const unitsPerPackage = packageVisible ? Math.max(1, Number(packageSize) || 1) : 1
  const qty = Number(quantity) || 0
  const price = Number(purchasePrice) || 0
  const cost = trackStock ? (buyBasis === 'package' ? price / unitsPerPackage : buyBasis === 'all' ? price / Math.max(1, qty) : price) : Number(estimatedCost) || 0
  const sell = Number(sellingPrice) || 0
  const profit = sell - cost
  return { unitsPerPackage, cost, profit, margin: sell ? profit / sell * 100 : 0, stockValue: trackStock ? qty * cost : 0, profitPerPackage: (Number(packagePrice) || 0) - cost * unitsPerPackage, packageDeduction: unitsPerPackage, belowCost: sell > 0 && sell < cost }
}

export const calcProduct = (config, values = {}) => productCalculations({ trackStock: values.trackStock !== false, buyBasis: values.buyBasis, purchasePrice: values.buyPrice ?? values.costPrice, estimatedCost: values.estimatedCost ?? values.estimatedCostPerUnit, quantity: values.quantity, packageSize: values.packageSize, packagePrice: values.packageSellPrice ?? values.packageSellingPrice, sellingPrice: values.sellPrice ?? values.sellingPrice, packageVisible: isFieldVisible('pkg', config.fields || config, values.trackStock !== false) })

export function normalizeProductPayload(config, values = {}) {
  const fields = config.fields || config
  const visible = new Set(getVisibleFields({ fields }, values).flatMap((group) => group.fields.map((field) => field.key)))
  const calc = calcProduct({ fields }, values)
  const payload = { name: values.name, unit: values.unit, trackStock: values.trackStock !== false, sellingPrice: Number(values.sellingPrice || 0), status: values.status || 'ACTIVE' }
  const map = { category: 'category', brand: 'brand', model: 'model', qty: 'quantity', pkg: 'packageName', buy: 'buyPrice', est: 'estimatedCostPerUnit', psell: 'packageSellingPrice', exp: 'expiryDate', low: 'lowStockLevel', loc: 'location', sup: 'supplier' }
  for (const [key, target] of Object.entries(map)) if (visible.has(key)) payload[target] = values[target] ?? values[key]
  if (visible.has('pkg')) payload.packageSize = values.packageSize
  if (visible.has('buy')) payload.buyBasis = values.buyBasis || 'unit'
  payload.costPrice = calc.cost
  return payload
}
