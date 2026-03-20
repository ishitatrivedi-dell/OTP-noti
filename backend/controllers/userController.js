const User = require('../models/User');
const { generateUserToken } = require('../services/jwtService');

async function getCurrentUser(req, res) {
  try {
    const user = await User.findById(req.user.id).select('-__v');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate new token to extend session
    const token = generateUserToken(user);
    
    res.json({
      user: {
        id: user._id,
        email: user.email,
        isVerified: user.isVerified,
        createdAt: user.createdAt
      },
      token
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function updateProfile(req, res) {
  const logger = req.app.get('logger');
  
  try {
    const { displayName, avatar } = req.body;
    const userId = req.user.id;
    
    const updateData = {};
    if (displayName) updateData.displayName = displayName;
    if (avatar) updateData.avatar = avatar;
    
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-__v');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await logger.info('PROFILE_UPDATE', 'User profile updated', {
      userId,
      meta: { fields: Object.keys(updateData) }
    });
    
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        email: user.email,
        isVerified: user.isVerified,
        displayName: user.displayName,
        avatar: user.avatar,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    await logger?.info('ERROR', 'Profile update failed', {
      userId: req.user.id,
      meta: { error: String(error) }
    });
    res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getCurrentUser, updateProfile };
