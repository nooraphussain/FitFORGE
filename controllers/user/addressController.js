const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');

const manageAddresses = async (req, res) => {
  try {
    const userId = req.session.user;
    console.log('User Id is here', userId);
    const userData = await User.findOne({ _id: userId });
    const addressData = await Address.findOne({ userId: userId });

    res.render('user/manageAddress', { user: userData, addressData: addressData });
  } catch (error) {
    console.error("Error loading addresses:", error);
    res.redirect("/pageNotFound");
  }
};

const postAddressAction = async (req, res) => {
    try {
      const userId = req.session.user;
      const action = req.body.action; // "add", "edit", or "delete"

      const redirectTo = req.body.redirectTo;
      const redirectUrl = redirectTo === "checkout" ? "/checkout" : "/account/addresses";
  
      if (action === "add") {
        const { locationTypeTag, name, city, addressLine1, landmark, state, pincode, phone, alternatePhone } = req.body;

        if (!locationTypeTag || !name || !city || !addressLine1 || !state || !pincode || !phone) {
          return res.status(400).send("All required fields are required");
        }
        let userAddress = await Address.findOne({ userId: userId });
        if (!userAddress) {
          const newAddress = new Address({
            userId: userId,
            address: [{
              addressType: locationTypeTag,
              name: name,
              city: city,
              addressLine: addressLine1,
              landMark: landmark || "",
              state: state,
              pincode: pincode,
              phone: phone,
              altPhone: alternatePhone || ""
            }]
          });
          await newAddress.save();
        } else {
          userAddress.address.push({
            addressType: locationTypeTag,
            name: name,
            city: city,
            addressLine: addressLine1,
            landMark: landmark || "",
            state: state,
            pincode: pincode,
            phone: phone,
            altPhone: alternatePhone || ""
          });
          await userAddress.save();
        }
        return res.redirect(redirectUrl);
  
      } else if (action === "edit") {
        const { addressId, locationTypeTag, name, city, addressLine1, landmark, state, pincode, phone, alternatePhone } = req.body;
        if (!addressId || !locationTypeTag || !name || !city || !addressLine1 || !state || !pincode || !phone) {
          return res.status(400).send("All required fields are required for editing");
        }
        const findAddress = await Address.findOne({ "address._id": addressId });
        if (!findAddress) {
          return res.redirect("/pageNotFound");
        }
        await Address.updateOne(
          { "address._id": addressId },
          { $set: { "address.$": { 
              _id: addressId,
              addressType: locationTypeTag,
              name: name,
              city: city,
              addressLine: addressLine1,
              landMark: landmark || "",
              state: state,
              pincode: pincode,
              phone: phone,
              altPhone: alternatePhone || ""
            } } }
        );
        return res.redirect(redirectUrl);
  
      } else if (action === "delete") {
        const { addressId } = req.body;
        if (!addressId) {
          return res.status(400).send("Address ID is required");
        }
        await Address.updateOne(
          { "address._id": addressId },
          { $pull: { address: { _id: addressId } } }
        );
        return res.redirect(redirectUrl);
  
      } else {
        return res.status(400).send("Invalid action");
      }
    } catch (error) {
      console.error("Error processing address action:", error);
      return res.redirect("/pageNotFound");
    }
  };
  

module.exports = {
  manageAddresses,
  postAddressAction
};
