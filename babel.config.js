module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4.x moved its Babel transform into react-native-worklets.
    plugins: ['react-native-worklets/plugin'],
  };
};
