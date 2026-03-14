const path = require("path");

module.exports = function (api) {
  api.cache(true);

  const widgetDir = path.join(__dirname, "widget") + path.sep;
  const normalizedWidgetDir = widgetDir.replace(/\\/g, "/");

  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // React Compiler cannot run on widget files because they are invoked outside React.
          "react-compiler": {
            sources: (filename) => {
              if (!filename) {
                return true;
              }
              const normalizedFile = filename.replace(/\\/g, "/");
              return !normalizedFile.startsWith(normalizedWidgetDir);
            },
          },
        },
      ],
    ],
    plugins: ["react-native-reanimated/plugin"],
  };
};