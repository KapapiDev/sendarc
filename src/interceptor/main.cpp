#include <windows.h>
#include "mapi_impl.h"
#include "mapi_types.h"
#include "fs_utils.h"

#ifdef _MSC_VER
#define SENDARC_MAPI_NOEXCEPT WIN_NOEXCEPT
#else
#define SENDARC_MAPI_NOEXCEPT
#endif

// Forward exports - these will be called through the .def file
extern "C" {

ULONG STDAPICALLTYPE MAPISendMail(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    LPMapiMessage lpMessage,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPISendMailA(lhSession, ulUIParam, lpMessage, flFlags, ulReserved);
}

ULONG STDAPICALLTYPE MAPISendMailW(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    LPMapiMessageW lpMessage,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPISendMailW(lhSession, ulUIParam, lpMessage, flFlags, ulReserved);
}

ULONG STDAPICALLTYPE MAPILogon(
    ULONG_PTR ulUIParam,
    LPSTR lpszProfileName,
    LPSTR lpszPassword,
    FLAGS flFlags,
    ULONG ulReserved,
    LPLHANDLE lphSession
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPILogon(ulUIParam, lpszProfileName, lpszPassword, flFlags, ulReserved, lphSession);
}

ULONG STDAPICALLTYPE MAPILogoff(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPILogoff(lhSession, ulUIParam, flFlags, ulReserved);
}

ULONG STDAPICALLTYPE MAPIFreeBuffer(LPVOID pv) {
    return go_mapi::MapiImpl::MAPIFreeBuffer(pv);
}

ULONG STDAPICALLTYPE MAPISendDocuments(
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

#if defined(_MSC_VER) && defined(_M_X64)
namespace {

// A .def export is only visible to the linker. Keep typed, volatile address
// references in the image so the compiler also treats every Simple MAPI
// entry point as an indirect-call target and emits its XFG prototype record.
decltype(&MAPISendMail) volatile g_xfgMapiSendMail = &MAPISendMail;
decltype(&MAPISendMailW) volatile g_xfgMapiSendMailW = &MAPISendMailW;
decltype(&MAPILogon) volatile g_xfgMapiLogon = &MAPILogon;
decltype(&MAPILogoff) volatile g_xfgMapiLogoff = &MAPILogoff;
decltype(&MAPIFreeBuffer) volatile g_xfgMapiFreeBuffer = &MAPIFreeBuffer;
decltype(&MAPISendDocuments) volatile g_xfgMapiSendDocuments = &MAPISendDocuments;

bool HasXfgExportTargets() {
    return g_xfgMapiSendMail && g_xfgMapiSendMailW && g_xfgMapiLogon &&
           g_xfgMapiLogoff && g_xfgMapiFreeBuffer && g_xfgMapiSendDocuments;
}

}  // namespace
#endif

// DLL Entry Point
BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
    case DLL_PROCESS_ATTACH:
#if defined(_MSC_VER) && defined(_M_X64)
        if (!HasXfgExportTargets()) {
            return FALSE;
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
