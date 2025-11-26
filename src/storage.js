const mongoose = require('mongoose');
const chalk = require('chalk');

const soulSchema = new mongoose.Schema({
  phone: { type: String, required: true },
  session: { type: String, required: true },
  owner: { type: String, required: true, index: true },
  username: String,
  uid: String,
  created: { type: Date, default: Date.now }
});

soulSchema.index({ phone: 1, owner: 1 }, { unique: true });

const Soul = mongoose.model('Soul', soulSchema);

const penetrateCloud = async (uri) => {
  try {
    await mongoose.connect(uri);
    return true;
  } catch (e) {
    return false;
  }
};

const buryBody = async (phone, session, me, ownerKey) => {
  const exists = await Soul.findOne({ phone: phone, owner: ownerKey });
  if (exists) {
    exists.session = session;
    exists.username = me.username || 'Anon';
    exists.uid = me.id.toString();
    await exists.save();
  } else {
    await new Soul({
      phone,
      session,
      owner: ownerKey,
      username: me.username || 'Anon',
      uid: me.id.toString()
    }).save();
  }
};

const digUpBodies = async (ownerKey) => {
  return await Soul.find({ owner: ownerKey });
};

const burnBody = async (phone, ownerKey) => {
  await Soul.deleteOne({ phone: phone, owner: ownerKey });
};

module.exports = { penetrateCloud, buryBody, digUpBodies, burnBody };