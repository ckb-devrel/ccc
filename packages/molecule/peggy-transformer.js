const peggy = require("peggy");

module.exports = {
  process(sourceText) {
    const parser = peggy.generate(sourceText, {
      output: "source",
      format: "commonjs",
    });

    return {
      code: parser,
    };
  },
};
