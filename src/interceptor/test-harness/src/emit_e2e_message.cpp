#include <windows.h>

#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>

#include "../test_utils.h"
#include "../../mapi_types.h"

using namespace mapi_test;

namespace {

using MAPISendMailWFunc = ULONG(WINAPI *)(
    LHANDLE,
    ULONG_PTR,
    LPMapiMessageW,
    ULONG,
    ULONG);

}  // namespace

// Emit one representative wide Simple MAPI message through the actual
// interceptor DLL. Unlike the ordinary harness cases, this deliberately leaves
// the generated queue item in place so the live Wails watcher can render it.
int emit_e2e_message() {
    HMODULE module = TestUtilities::LoadInterceptorDll();
    if (!module) return 1;

    auto sendMail = reinterpret_cast<MAPISendMailWFunc>(
        GetProcAddress(module, "MAPISendMailW"));
    if (!sendMail) {
        std::cerr << "Failed to resolve MAPISendMailW" << std::endl;
        FreeLibrary(module);
        return 1;
    }

    std::filesystem::path sourcePath = std::filesystem::temp_directory_path() /
        (L"SendArc-native-e2e-" + std::to_wstring(GetCurrentProcessId()) +
         L"-\uac80\uc99d.txt");
    {
        std::ofstream source(sourcePath, std::ios::binary | std::ios::trunc);
        source << "Native MAPI attachment proof";
        if (!source) {
            std::cerr << "Failed to create native E2E attachment" << std::endl;
            FreeLibrary(module);
            return 1;
        }
    }

    wchar_t subject[] = L"Native MAPI preview proof";
    wchar_t body[] = L"Native Simple MAPI body: \uc548\ub155\ud558\uc138\uc694 \u00b7 caf\u00e9";
    wchar_t toName[] = L"Alice";
    wchar_t toAddress[] = L"SMTP:alice@example.com";
    wchar_t ccName[] = L"Carlos";
    wchar_t ccAddress[] = L"SMTP:carlos@example.com";
    wchar_t bccName[] = L"Bea";
    wchar_t bccAddress[] = L"SMTP:bea@example.com";
    wchar_t attachmentName[] = L"\ub124\uc774\ud2f0\ube0c-\uc99d\ube59.txt";

    MapiRecipDescW recipients[3] = {};
    recipients[0].ulRecipClass = MAPI_TO;
    recipients[0].lpszName = toName;
    recipients[0].lpszAddress = toAddress;
    recipients[1].ulRecipClass = MAPI_CC;
    recipients[1].lpszName = ccName;
    recipients[1].lpszAddress = ccAddress;
    recipients[2].ulRecipClass = MAPI_BCC;
    recipients[2].lpszName = bccName;
    recipients[2].lpszAddress = bccAddress;

    std::wstring attachmentPath = sourcePath.wstring();
    MapiFileDescW attachment = {};
    attachment.lpszPathName = attachmentPath.data();
    attachment.lpszFileName = attachmentName;

    MapiMessageW message = {};
    message.lpszSubject = subject;
    message.lpszNoteText = body;
    message.nRecipCount = 3;
    message.lpRecips = recipients;
    message.nFileCount = 1;
    message.lpFiles = &attachment;

    ULONG result = sendMail(0, 0, &message, 0, 0);
    std::error_code removeError;
    std::filesystem::remove(sourcePath, removeError);
    FreeLibrary(module);

    if (result != SUCCESS_SUCCESS) {
        std::cerr << "MAPISendMailW returned " << result << std::endl;
        return 1;
    }
    std::cout << "Native Simple MAPI message queued" << std::endl;
    return 0;
}
