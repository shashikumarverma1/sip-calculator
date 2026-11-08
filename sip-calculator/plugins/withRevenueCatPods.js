const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

// iOS only. react-native-purchases 11.x needs PurchasesHybridCommon 20.4.0 / RevenueCat 5.101.0,
// which are not on the CocoaPods trunk CDN (trunk is read-only). Their podspecs are tagged on
// GitHub, so pin the pods to those tags. When upgrading react-native-purchases, update these to
// match RNPurchases.podspec and the PurchasesHybridCommon podspec's RevenueCat dependency.
const PHC_VERSION = '20.4.0';
const RC_VERSION = '5.101.0';

const PODS = [
  `pod 'RevenueCat', :git => 'https://github.com/RevenueCat/purchases-ios.git', :tag => '${RC_VERSION}'`,
  `pod 'RevenueCatUI', :git => 'https://github.com/RevenueCat/purchases-ios.git', :tag => '${RC_VERSION}'`,
  `pod 'PurchasesHybridCommon', :git => 'https://github.com/RevenueCat/purchases-hybrid-common.git', :tag => '${PHC_VERSION}'`,
  `pod 'PurchasesHybridCommonUI', :git => 'https://github.com/RevenueCat/purchases-hybrid-common.git', :tag => '${PHC_VERSION}'`,
];

function withRevenueCatPods(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      const src = fs.readFileSync(podfile, 'utf8');
      const result = mergeContents({
        src,
        newSrc: PODS.map((p) => `  ${p}`).join('\n'),
        tag: 'revenuecat-git-pods',
        anchor: /use_expo_modules!/,
        offset: 1,
        comment: '#',
      });
      fs.writeFileSync(podfile, result.contents);
      return cfg;
    },
  ]);
}

module.exports = withRevenueCatPods;
