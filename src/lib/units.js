export const kgToLbs = (kg) => Math.round(kg * 2.20462 * 10) / 10
export const lbsToKg = (lbs) => parseFloat((lbs * 0.453592).toFixed(2))

export const cmToFtIn = (cm) => {
  const totalInches = cm / 2.54
  const ft = Math.floor(totalInches / 12)
  const inches = Math.round(totalInches % 12)
  return { ft, inches }
}

export const ftInToCm = (ft, inches) =>
  parseFloat(((parseInt(ft || 0) * 12 + parseInt(inches || 0)) * 2.54).toFixed(1))
