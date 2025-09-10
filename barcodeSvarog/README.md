# barcodeSvarog (Expo)

Мобильное приложение для сканирования и декодирования штрихкодов. Основано на Expo (managed). Поддерживает EAN-8/13, Code128/39, ITF, QR.

## Быстрый старт

1. Установить зависимости:

```
npm install
```

2. Запуск в режиме разработки (Android-эмулятор или устройство):

```
npm run android
```

> На физическом устройстве: установите Expo Go из Google Play и отсканируйте QR с экрана терминала.

## Сборка APK локально (без аккаунта Expo)

Expo рекомендует EAS Build, но для быстрого локального APK можно использовать `expo prebuild` + `gradlew assembleRelease`.

Шаги (Windows):

1. Установите Android Studio (SDK, Build-Tools, Platform Tools). Проверьте `ANDROID_HOME` и `JAVA_HOME`.
2. Выполните:

```
npx expo prebuild --platform android --no-install
npm install
cd android
gradlew assembleRelease
```

APK будет в `android/app/build/outputs/apk/release/app-release.apk`.

## Примечания

- Для максимальной точности направляйте камеру параллельно полосам штрихкода и заполняйте кадр.
- Если нужен офлайн-движок с расширенной обработкой (например, ZXing native/ML Kit), можно перейти на bare workflow.





