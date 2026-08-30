#include <windows.h>
#include "mapi_impl.h"
#include "mapi_types.h"
#include "fs_utils.h"

#ifdef _MSC_VER
#define SENDARC_MAPI_NOEXCEPT WIN_NOEXCEPT
#else
#define SENDARC_MAPI_NOEXCEPT
#endif

// The .def file keeps the stable Simple MAPI export names. On x64 MSVC,
// dllexport also tells the compiler that these definitions are externally
// addressable, so /guard:xfg emits a prototype hash for each export target.
// XFG is unavailable for x86, where the .def file remains authoritative.
#if defined(_MSC_VER) && defined(_M_X64)
#define SENDARC_MAPI_EXPORT __declspec(dllexport)
#else
#define SENDARC_MAPI_EXPORT
#endif

// Forward exports - these will be called through the .def file
extern "C" {

SENDARC_MAPI_EXPORT ULONG STDAPICALLTYPE MAPISendMail(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    LPMapiMessage lpMessage,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPISendMailA(lhSession, ulUIParam, lpMessage, flFlags, ulReserved);
}

SENDARC_MAPI_EXPORT ULONG STDAPICALLTYPE MAPISendMailW(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    LPMapiMessageW lpMessage,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPISendMailW(lhSession, ulUIParam, lpMessage, flFlags, ulReserved);
}

SENDARC_MAPI_EXPORT ULONG STDAPICALLTYPE MAPILogon(
    ULONG_PTR ulUIParam,
    LPSTR lpszProfileName,
    LPSTR lpszPassword,
    FLAGS flFlags,
    ULONG ulReserved,
    LPLHANDLE lphSession
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPILogon(ulUIParam, lpszProfileName, lpszPassword, flFlags, ulReserved, lphSession);
}

SENDARC_MAPI_EXPORT ULONG STDAPICALLTYPE MAPILogoff(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPILogoff(lhSession, ulUIParam, flFlags, ulReserved);
}

SENDARC_MAPI_EXPORT ULONG STDAPICALLTYPE MAPIFreeBuffer(LPVOID pv) {
    return go_mapi::MapiImpl::MAPIFreeBuffer(pv);
}

SENDARC_MAPI_EXPORT ULONG STDAPICALLTYPE MAPISendDocuments(
    ULONG_PTR ulUIParam,
    LPSTR lpszDelimChar,
    LPSTR lpszFilePaths,
    LPSTR lpszFileNames,
    ULONG ulReserved
) {
    return go_mapi::MapiImpl::MAPISendDocuments(ulUIParam, lpszDelimChar, lpszFilePaths, lpszFileNames, ulReserved);
}

}  // extern "C"

#undef SENDARC_MAPI_NOEXCEPT
#undef SENDARC_MAPI_EXPORT

// DLL Entry Point
BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
    case DLL_PROCESS_ATTACH:
        // Initialize on DLL load
        go_mapi::FsUtils::EnsureOutputDirectory();
        break;
    case DLL_PROCESS_DETACH:
        // Cleanup on DLL unload
        break;
    case DLL_THREAD_ATTACH:
    case DLL_THREAD_DETACH:
        // Thread-specific initialization/cleanup
        break;
    }
    return TRUE;
}
