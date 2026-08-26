package com.example.dokad

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.os.Bundle
import android.os.Looper
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.example.dokad.auth.BiometricAuthManager
import com.example.dokad.theme.DokadTheme
import com.example.dokad.ui.main.MainScreen
import com.example.dokad.ui.main.MainScreenViewModel
import com.google.android.gms.location.*

class MainActivity : FragmentActivity() {

    private val viewModel: MainScreenViewModel by viewModels()
    private lateinit var biometricAuthManager: BiometricAuthManager
    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private var locationCallback: LocationCallback? = null

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineLocationGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val cameraGranted = permissions[Manifest.permission.CAMERA] ?: false

        if (fineLocationGranted) {
            startLocationUpdates()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        biometricAuthManager = BiometricAuthManager(this)
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        requestRequiredPermissions()

        setContent {
            DokadTheme {
                MainScreen(
                    viewModel = viewModel,
                    onTriggerBiometrics = { triggerBiometricPrompt() }
                )
            }
        }

        // Auto-prompt biometrics on launch
        triggerBiometricPrompt()
    }

    private fun requestRequiredPermissions() {
        val permissionsToRequest = mutableListOf<String>()

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
            permissionsToRequest.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            permissionsToRequest.add(Manifest.permission.CAMERA)
        }

        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        } else {
            startLocationUpdates()
        }
    }

    private fun startLocationUpdates() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            return
        }

        val locationRequest = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, 3000)
            .setMinUpdateIntervalMillis(1500)
            .setMinUpdateDistanceMeters(2f)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val loc: Location = locationResult.lastLocation ?: return
                viewModel.updateLocation(loc.latitude, loc.longitude)
            }
        }

        fusedLocationClient.requestLocationUpdates(locationRequest, locationCallback!!, Looper.getMainLooper())
    }

    private fun triggerBiometricPrompt() {
        if (biometricAuthManager.isBiometricAvailable()) {
            biometricAuthManager.promptBiometric(
                title = "DOKĄD? PRIVATE",
                subtitle = "Authenticate with Passkey / Biometrics",
                onSuccess = { viewModel.unlockApp() },
                onError = { err -> viewModel.showToast(err) }
            )
        } else {
            // If biometrics not set up on device, auto unlock
            viewModel.unlockApp()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
    }
}
