const Pwgen = require("pwgen/lib/pwgen_module");

function generatePassword(
    maxLength = 16,
    includeCapitalLetter = true,
    includeNumber = true
) {
    const pwgenGenerator = new Pwgen();
    pwgenGenerator.includeCapitalLetter = includeCapitalLetter;
    pwgenGenerator.includeNumber = includeNumber;
    pwgenGenerator.maxLength = maxLength;

    return pwgenGenerator.generate();
}

module.exports = generatePassword;
