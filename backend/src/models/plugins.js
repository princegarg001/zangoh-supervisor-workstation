// Every model exposes a business `id` field, so strip Mongo internals from API output.
function cleanJson(schema) {
  const transform = (doc, ret) => {
    delete ret._id;
    delete ret.__v;
    return ret;
  };
  schema.set('toJSON', { virtuals: false, transform });
  schema.set('toObject', { virtuals: false, transform });
}

module.exports = { cleanJson };
