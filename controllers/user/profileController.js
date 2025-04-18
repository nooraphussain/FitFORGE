const User = require('../../models/userSchema');

const loadAccount = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log('User Id is here', userId);
        const userData = await User.findOne({ _id: userId });
        console.log('user datas', userData);
        res.render('user/account', { user: userData });
    } catch (error) {
        console.log('error while loading the account page', error);
        res.redirect('/pagenotfound');
    }
};

const editAccount = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }
        const { firstName } = req.body;
        if (!firstName || firstName.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid name' });
        }
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { name: firstName },
            { new: true }
        );
        if (!updatedUser) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, message: 'Profile updated successfully', user: updatedUser });
    } catch (error) {
        console.error('Error updating account:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};

const saveDetails = async (req, res) => {
    try {
        const { fullName, email, mobile } = req.body;
        const userId = req.session.user;
        const updateData = await User.updateOne(
            { _id: userId },
            { $set: { name: fullName, email: email, phoneNumber: mobile } }
        );
        if (updateData.modifiedCount > 0) {
            return res.status(200).json({ success: true, message: 'Successfully updated the user data!' });
        }
        return res.status(500).json({ success: false, message: 'Error while updating the details!' });
    } catch (error) {
        console.log('Error while updating the data', error);
        res.redirect('/pageNotFound');
    }
};

const verifyOtp = async (req, res) => {
    try {
      const { otpValue, resend } = req.body;
      if (resend) {
        const newOtp = Math.floor(100000 + Math.random() * 900000);
        req.session.userOtp = newOtp;
        console.log("New OTP:", newOtp);
        return res.json({ success: true, message: 'OTP sent successfully!' });
      } else {
        const serverOtp = req.session.userOtp;
        if (parseInt(serverOtp) === parseInt(otpValue)) {
          return res.status(200).json({ success: true, message: 'Successfully verified' });
        }
        return res.status(200).json({ success: false, message: 'Invalid OTP! Please try again' });
      }
    } catch (error) {
      console.log('Error while verifying OTP:', error);
      // Instead of redirecting, send a JSON error response:
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };
  
  

const saveEmail = async (req, res) => {
    try {
        const userId = req.session.user;
        const { newEmail } = req.body;
        if (!newEmail || newEmail.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid email' });
        }
        const changingEmail = await User.updateOne(
            { _id: userId },
            { $set: { email: newEmail } }
        );
        if (changingEmail.modifiedCount > 0) {
            return res.status(200).json({ success: true, message: 'Email updated successfully!' });
        }
        return res.status(500).json({ success: false, message: 'Error while updating the email id!' });
    } catch (error) {
        console.log('Error while updating the email id', error);
        res.redirect('/pageNotFound');
    }
};


const resendOtp = async (req, res) => {
    try {
        const otp = Math.floor(100000 + Math.random() * 900000);
        req.session.userOtp = otp;
        console.log('Resent OTP:', otp);
        res.json({ success: true, message: 'OTP resent successfully!' });
    } catch (error) {
        console.log('Error resending OTP:', error);
        res.status(500).json({ success: false, message: 'Error resending OTP' });
    }
};


const updateEmail = async (req, res) => {
    try {
        const userId = req.session.user;
        const { newEmail } = req.body;
        if (!newEmail || newEmail.trim().length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid email' });
        }
        const changingEmail = await User.updateOne(
            { _id: userId },
            { $set: { email: newEmail } }
        );
        if (changingEmail.modifiedCount > 0) {
            return res.status(200).json({ success: true, message: 'Email updated successfully!' });
        }
        return res.status(500).json({ success: false, message: 'Error while updating the email id!' });
    } catch (error) {
        console.log('Error while updating the email id', error);
        res.redirect('/pageNotFound');
    }
};

const verifyMobileOtp = async (req, res) => {
    try {
      const { otpValue, resend } = req.body;
      if (resend) {
        const newOtp = Math.floor(100000 + Math.random() * 900000);
        req.session.mobileOtp = newOtp;
        console.log("New Mobile OTP:", newOtp);
        return res.json({ success: true, message: 'Mobile OTP sent successfully!' });
      } else {
        const serverOtp = req.session.mobileOtp;
        if (parseInt(serverOtp) === parseInt(otpValue)) {
          return res.status(200).json({ success: true, message: 'Mobile OTP verified successfully' });
        }
        return res.status(200).json({ success: false, message: 'Invalid Mobile OTP! Please try again' });
      }
    } catch (error) {
      console.log('Error verifying Mobile OTP:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };
  
  const updateMobile = async (req, res) => {
    try {
      const userId = req.session.user;
      const { mobile } = req.body;
      if (!mobile || !/^\d{10}$/.test(mobile)) {
        return res.status(400).json({ success: false, message: 'Invalid mobile number' });
      }
      const changingMobile = await User.updateOne(
        { _id: userId },
        { $set: { phoneNumber: mobile } }
      );
      if (changingMobile.modifiedCount > 0) {
        return res.status(200).json({ success: true, message: 'Mobile updated successfully!' });
      }
      return res.status(500).json({ success: false, message: 'Error while updating mobile' });
    } catch (error) {
      console.log('Error updating mobile:', error);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };
  

module.exports = {
    loadAccount,
    editAccount,
    verifyOtp,
    saveEmail,
    saveDetails,
    resendOtp,   
    updateEmail,
    verifyMobileOtp, 
    updateMobile
}