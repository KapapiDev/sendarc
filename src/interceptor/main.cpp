#include <windows.h>
#include "mapi_impl.h"
#include "mapi_types.h"
#include "fs_utils.h"

#ifdef _MSC_VER
#define SENDARC_MAPI_NOEXCEPT WIN_NOEXCEPT
#else
#define SENDARC_MAPI_NOEXCEPT
#endif

// Current x64 Windows mapi32.dll validates Simple MAPI providers through XFG.
// The companion MASM file owns the public x64 entry points and their canonical
// hashes, then tail-jumps to these implementation names. x86 and portable
// builds keep exporting the C++ definitions directly.
#if defined(_MSC_VER) && defined(_M_X64)
#define SENDARC_MAPI_ENTRY(name) SendArc_##name##_Impl
#else
#define SENDARC_MAPI_ENTRY(name) name
#endif

// Forward exports - these will be called through the .def file
extern "C" {

ULONG STDAPICALLTYPE SENDARC_MAPI_ENTRY(MAPISendMail)(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    LPMapiMessage lpMessage,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPISendMailA(lhSession, ulUIParam, lpMessage, flFlags, ulReserved);
}

ULONG STDAPICALLTYPE SENDARC_MAPI_ENTRY(MAPISendMailW)(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    LPMapiMessageW lpMessage,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPISendMailW(lhSession, ulUIParam, lpMessage, flFlags, ulReserved);
}

ULONG STDAPICALLTYPE SENDARC_MAPI_ENTRY(MAPILogon)(
    ULONG_PTR ulUIParam,
    LPSTR lpszProfileName,
    LPSTR lpszPassword,
    FLAGS flFlags,
    ULONG ulReserved,
    LPLHANDLE lphSession
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPILogon(ulUIParam, lpszProfileName, lpszPassword, flFlags, ulReserved, lphSession);
}

ULONG STDAPICALLTYPE SENDARC_MAPI_ENTRY(MAPILogoff)(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT {
    return go_mapi::MapiImpl::MAPILogoff(lhSession, ulUIParam, flFlags, ulReserved);
}

ULONG STDAPICALLTYPE SENDARC_MAPI_ENTRY(MAPIFreeBuffer)(LPVOID pv) {
    return go_mapi::MapiImpl::MAPIFreeBuffer(pv);
}

ULONG STDAPICALLTYPE SENDARC_MAPI_ENTRY(MAPISendDocuments)(
    ULONG_PTR ulUIParam,
    LPSTR lpszDelimChar,
    LPSTR lpszFilePaths,
    LPSTR lpszFileNames,
    ULONG ulReserved
) {
    return go_mapi::MapiImpl::MAPISendDocuments(ulUIParam, lpszDelimChar, lpszFilePaths, lpszFileNames, ulReserved);
}

}  // extern "C"

#if defined(_MSC_VER) && defined(_M_X64)
// The public x64 names are implemented by mapi_xfg_exports.asm. Declare and
// take their addresses in guarded C++ code so the MSVC toolchain records the
// assembly landing pads as valid CFG targets. XFG validates the hash at
// target-8, but the underlying CFG gate must also accept the target RVA.
extern "C" {

ULONG STDAPICALLTYPE MAPISendMail(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    LPMapiMessage lpMessage,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT;

ULONG STDAPICALLTYPE MAPISendMailW(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    LPMapiMessageW lpMessage,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT;

ULONG STDAPICALLTYPE MAPILogon(
    ULONG_PTR ulUIParam,
    LPSTR lpszProfileName,
    LPSTR lpszPassword,
    FLAGS flFlags,
    ULONG ulReserved,
    LPLHANDLE lphSession
) SENDARC_MAPI_NOEXCEPT;

ULONG STDAPICALLTYPE MAPILogoff(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    FLAGS flFlags,
    ULONG ulReserved
) SENDARC_MAPI_NOEXCEPT;

ULONG STDAPICALLTYPE MAPIFreeBuffer(LPVOID pv);

ULONG STDAPICALLTYPE MAPISendDocuments(
    ULONG_PTR ulUIParam,
    LPSTR lpszDelimChar,
    LPSTR lpszFilePaths,
    LPSTR lpszFileNames,
    ULONG ulReserved
);

}  // extern "C"

namespace {

volatile LONG g_guardMetadataSelector = 0;
decltype(&MAPISendMail) volatile g_guardMapiSendMail = &MAPISendMail;
decltype(&MAPISendMailW) volatile g_guardMapiSendMailW = &MAPISendMailW;
decltype(&MAPILogon) volatile g_guardMapiLogon = &MAPILogon;
decltype(&MAPILogoff) volatile g_guardMapiLogoff = &MAPILogoff;
decltype(&MAPIFreeBuffer) volatile g_guardMapiFreeBuffer = &MAPIFreeBuffer;
decltype(&MAPISendDocuments) volatile g_guardMapiSendDocuments = &MAPISendDocuments;

__declspec(noinline) ULONG InvokeGuardMetadataAnchor(LONG selector) {
    switch (selector) {
    case 1:
        return g_guardMapiSendMail(0, 0, nullptr, 0, 0);
    case 2:
        return g_guardMapiSendMailW(0, 0, nullptr, 0, 0);
    case 3:
        return g_guardMapiLogon(0, nullptr, nullptr, 0, 0, nullptr);
    case 4:
        return g_guardMapiLogoff(0, 0, 0, 0);
    case 5:
        return g_guardMapiFreeBuffer(nullptr);
    case 6:
        return g_guardMapiSendDocuments(0, nullptr, nullptr, nullptr, 0);
    default:
        return SUCCESS_SUCCESS;
    }
}

}  // namespace
#endif

#undef SENDARC_MAPI_NOEXCEPT
#undef SENDARC_MAPI_ENTRY

// DLL Entry Point
BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
    case DLL_PROCESS_ATTACH:
#if defined(_MSC_VER) && defined(_M_X64)
        if (g_guardMetadataSelector != 0) {
            InvokeGuardMetadataAnchor(g_guardMetadataSelector);
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
