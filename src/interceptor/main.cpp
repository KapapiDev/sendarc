#include <windows.h>
#include "mapi_impl.h"
#include "mapi_types.h"
#include "fs_utils.h"

#ifdef _MSC_VER
#define SENDARC_MAPI_NOEXCEPT WIN_NOEXCEPT
#else
#define SENDARC_MAPI_NOEXCEPT
#endif

// The .def file preserves the stable Simple MAPI names. On x64, dllexport also
// makes the compiler own each public entry point so /guard:xfg emits the type
// hash immediately before the address returned by GetProcAddress. This is the
// address current Windows mapi32.dll validates before its indirect call.
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

#if defined(_MSC_VER) && defined(_M_X64)
namespace {

// MSVC emits a gxfg prototype record only when a function is a possible
// target of an instrumented indirect call. DLL exports alone receive CFG
// metadata but no XFG type hash. Keep a disabled, volatile dispatch anchor so
// every Simple MAPI export is compiled as a genuine XFG call target. The
// selector is initialized before DllMain and is never changed by SendArc.
volatile LONG g_xfgMetadataSelector = 0;
decltype(&MAPISendMail) volatile g_xfgMapiSendMail = &MAPISendMail;
decltype(&MAPISendMailW) volatile g_xfgMapiSendMailW = &MAPISendMailW;
decltype(&MAPILogon) volatile g_xfgMapiLogon = &MAPILogon;
decltype(&MAPILogoff) volatile g_xfgMapiLogoff = &MAPILogoff;
decltype(&MAPIFreeBuffer) volatile g_xfgMapiFreeBuffer = &MAPIFreeBuffer;
decltype(&MAPISendDocuments) volatile g_xfgMapiSendDocuments = &MAPISendDocuments;

__declspec(noinline) ULONG InvokeXfgMetadataAnchor(LONG selector) {
    switch (selector) {
    case 1:
        return g_xfgMapiSendMail(0, 0, nullptr, 0, 0);
    case 2:
        return g_xfgMapiSendMailW(0, 0, nullptr, 0, 0);
    case 3:
        return g_xfgMapiLogon(0, nullptr, nullptr, 0, 0, nullptr);
    case 4:
        return g_xfgMapiLogoff(0, 0, 0, 0);
    case 5:
        return g_xfgMapiFreeBuffer(nullptr);
    case 6:
        return g_xfgMapiSendDocuments(0, nullptr, nullptr, nullptr, 0);
    default:
        return SUCCESS_SUCCESS;
    }
}

}  // namespace
#endif

// DLL Entry Point
BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
    case DLL_PROCESS_ATTACH:
#if defined(_MSC_VER) && defined(_M_X64)
        if (g_xfgMetadataSelector != 0) {
            InvokeXfgMetadataAnchor(g_xfgMetadataSelector);
        }
#endif
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
