import test from 'node:test'
import assert from 'node:assert/strict'
import { createProductFieldConfig, isFieldVisible, productCalculations } from '../src/productForm.js'

test('calculates package costs and profit in RWF units', () => {
  const values = productCalculations({ trackStock: true, buyBasis: 'package', purchasePrice: 21600, packageSize: 24, packageVisible: true, quantity: 48, sellingPrice: 1200, packagePrice: 27000 })
  assert.deepEqual(values, { unitsPerPackage: 24, cost: 900, profit: 300, margin: 25, stockValue: 43200, profitPerPackage: 5400, packageDeduction: 24, belowCost: false })
})

test('applies visibility dependencies', () => {
  const fields = createProductFieldConfig('bar')
  assert.equal(isFieldVisible('qty', fields, false), false)
  assert.equal(isFieldVisible('est', fields, false), false)
  fields.est.show = true
  assert.equal(isFieldVisible('est', fields, false), true)
})
