import { f, notesField, type Field } from './forms';
export const cowFields: Field[] = [
  f('tagNumber', 'Tag number', 'text', true),
  f('name', 'Name'),
  f('sex', 'Sex', 'select', true, { options: ['FEMALE', 'MALE'] }),
  f('category', 'Category', 'select', true, { options: ['DAIRY', 'BEEF', 'HEIFER', 'CALF'] }),
  f('breed', 'Breed'),
  f('birthDate', 'Birth date', 'date'),
  f('birthDateEstimated', 'Birth date is estimated', 'checkbox'),
  f('origin', 'Origin', 'select', true, { options: ['PURCHASED', 'FARM_BORN'] }),
  f('purchaseDate', 'Purchase date', 'date'),
  f('purchasePrice', 'Purchase price (BDT)', 'number', false, { min: 0, step: '0.01' }),
  f('sellerName', 'Seller name'),
  f('sireDetails', 'Father / semen details'),
  notesField,
];
