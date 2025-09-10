import { StatusBar } from 'expo-status-bar'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, View, TouchableOpacity, Vibration } from 'react-native'
import { useCameraPermission, useCodeScanner, Camera } from 'react-native-vision-camera'
import * as Haptics from 'expo-haptics'
import { useKeepAwake } from 'expo-keep-awake'

function validateEAN(text) {
  const s = String(text || '').replace(/[^0-9]/g, '')
  if (!(s.length === 8 || s.length === 13)) return { ok: false }
  const digits = s.split('').map((d) => parseInt(d, 10))
  const check = digits.pop()
  const sum = digits.reverse().reduce((acc, d, idx) => acc + d * (idx % 2 === 0 ? 3 : 1), 0)
  const calc = (10 - (sum % 10)) % 10
  return { ok: calc === check, normalized: s }
}

export default function App() {
  useKeepAwake()
  const cameraRef = useRef(null)
  const { hasPermission, requestPermission } = useCameraPermission()
  const [scanning, setScanning] = useState(true)
  const [lastResult, setLastResult] = useState(null)
  const [cooldown, setCooldown] = useState(false)

  useEffect(() => {
    if (!hasPermission) requestPermission()
  }, [hasPermission])

  const codeScanner = useCodeScanner({
    codeTypes: ['ean-13', 'ean-8', 'code-128', 'code-39', 'itf', 'qr'],
    onCodeScanned: (codes) => {
      if (!scanning || cooldown || !codes?.length) return
      const value = codes[0]?.value
      if (!value) return
      setCooldown(true)
      setTimeout(() => setCooldown(false), 800)
      const ean = validateEAN(value)
      const header = `Тип: ${codes[0]?.type || 'unknown'}`
      const resultText = `${header}\nДанные: ${value}`
      setLastResult(ean.ok ? `${resultText}\nEAN OK: ${ean.normalized}` : resultText)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Vibration.vibrate(60)
    },
  })

  if (hasPermission === false) {
    return (
      <View style={styles.center}>
        <Text>Нет доступа к камере</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Camera ref={cameraRef} style={styles.camera} isActive={true} codeScanner={codeScanner}>
        <View style={styles.overlay}>
          <View style={styles.guide} />
        </View>
      </Camera>

      <View style={styles.bottomPanel}>
        <TouchableOpacity style={styles.btn} onPress={() => setScanning((s) => !s)}>
          <Text style={styles.btnText}>{scanning ? 'Пауза' : 'Сканировать'}</Text>
        </TouchableOpacity>
        <Text style={styles.result} numberOfLines={3}>
          {lastResult || 'Наведите камеру на штрихкод'}
        </Text>
      </View>
      <StatusBar style="light" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guide: {
    width: '80%',
    height: 120,
    borderColor: '#00E676',
    borderWidth: 3,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  bottomPanel: {
    padding: 16,
    backgroundColor: '#111',
  },
  btn: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#00E676',
    borderRadius: 6,
    marginBottom: 8,
  },
  btnText: { color: '#000', fontWeight: '700' },
  result: { color: '#fff', textAlign: 'center' },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
