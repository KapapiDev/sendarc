#include <windows.h>
#include <iostream>
#include <string>
#include <filesystem>
#include "../test_utils.h"

using namespace mapi_test;

// Test that strings in the active Windows ANSI codepage are properly converted
// to UTF-8. The runner may use CP1252, CP949, CP932, or another locale, so the
// test must not assume that a particular Western character is representable.
// Windows "Send to → Mail recipient" calls MAPISendMail (ANSI) with strings in the
// system codepage, NOT UTF-8. The DLL must convert them.
int test_ansi_encoding() {
    std::cout << "\nTest: ANSI Codepage Encoding" << std::endl;

    HMODULE hDll = TestUtilities::LoadInterceptorDll();
    if (!hDll) {
        return 1;
    }

    MAPISendMailFunc MAPISendMail = reinterpret_cast<MAPISendMailFunc>(
        GetProcAddress(hDll, "MAPISendMail")
    );
    if (!MAPISendMail) {
        std::cerr << "Failed to get MAPISendMail function" << std::endl;
        FreeLibrary(hDll);
        return 1;
    }

    // Clean up first
    std::string tempDir = TestUtilities::GetSendArcQueueDir();
    TestUtilities::CleanupTestFiles(tempDir);

    // Pick a non-ASCII character that round-trips in the machine's active ACP.
    // WC_NO_BEST_FIT_CHARS rejects lossy substitutions (for example ó -> o on
    // a Korean CP949 system), which was the source of the old locale-dependent
    // false failure.
    const wchar_t candidates[] = {
        L'\u00f3', L'\ud55c', L'\u65e5', L'\u4e2d', L'\u042f', L'\u010d',
        L'\u0151', L'\u03a9', L'\u05d0', L'\u0634', L'\u0e01'
    };
    const UINT activeCodePage = GetACP();
    const DWORD conversionFlags = activeCodePage == CP_UTF8 ? 0 : WC_NO_BEST_FIT_CHARS;
    wchar_t chosen = 0;
    for (wchar_t candidate : candidates) {
        char encoded[8] = {};
        BOOL usedDefault = FALSE;
        int count = WideCharToMultiByte(
            CP_ACP, conversionFlags, &candidate, 1, encoded, sizeof(encoded),
            nullptr, activeCodePage == CP_UTF8 ? nullptr : &usedDefault);
        if (count > 0 && (activeCodePage == CP_UTF8 || !usedDefault)) {
            chosen = candidate;
            break;
        }
    }
    if (chosen == 0) {
        std::cerr << "No non-ASCII round-trip candidate for ACP " << GetACP() << std::endl;
        FreeLibrary(hDll);
        return 1;
    }

    std::wstring wideSubject = L"SendArc active-codepage proof: ";
    wideSubject.push_back(chosen);
    char ansiSubject[256] = {};
    BOOL subjectUsedDefault = FALSE;
    int subjectBytes = WideCharToMultiByte(
        CP_ACP, conversionFlags, wideSubject.c_str(), -1, ansiSubject,
        sizeof(ansiSubject), nullptr,
        activeCodePage == CP_UTF8 ? nullptr : &subjectUsedDefault);
    if (subjectBytes <= 0 || (activeCodePage != CP_UTF8 && subjectUsedDefault)) {
        std::cerr << "Could not encode ACP test subject without loss" << std::endl;
        FreeLibrary(hDll);
        return 1;
    }

    char body[] = "Test body";
    char toAddress[] = "test@example.com";
    char toName[] = "Test User";

    MapiRecipDesc recipient = {};
    recipient.ulRecipClass = MAPI_TO;
    recipient.lpszName = toName;
    recipient.lpszAddress = toAddress;

    MapiMessage message = {};
    message.lpszSubject = ansiSubject;
    message.lpszNoteText = body;
    message.nRecipCount = 1;
    message.lpRecips = &recipient;
    message.nFileCount = 0;
    message.lpFiles = nullptr;

    ULONG result = MAPISendMail(0, 0, &message, 0, 0);
    std::cout << "MAPISendMail returned: " << result << std::endl;

    if (result != 0) {
        std::cerr << "MAPISendMail failed" << std::endl;
        FreeLibrary(hDll);
        return 1;
    }

    // Read the JSON and verify that the selected ACP character became its exact
    // UTF-8 representation, with no substitution or mojibake.
    std::string json = TestUtilities::ReadNewestJsonContent(tempDir);
    if (json.empty()) {
        std::cerr << "No JSON file found" << std::endl;
        FreeLibrary(hDll);
        return 1;
    }

    char expectedBytes[8] = {};
    int expectedCount = WideCharToMultiByte(
        CP_UTF8, 0, &chosen, 1, expectedBytes, sizeof(expectedBytes), nullptr, nullptr);
    if (expectedCount <= 0) {
        std::cerr << "Could not encode expected UTF-8 character" << std::endl;
        TestUtilities::CleanupTestFiles(tempDir);
        FreeLibrary(hDll);
        return 1;
    }
    std::string expected_utf8(expectedBytes, expectedCount);
    bool found = json.find(expected_utf8) != std::string::npos;

    if (found) {
        std::cout << "  ACP " << GetACP() << " subject correctly converted to UTF-8" << std::endl;
    } else {
        std::cerr << "  ANSI subject NOT correctly converted! Mojibake detected." << std::endl;
        // Show what we got
        auto pos = json.find("subject");
        if (pos != std::string::npos) {
            std::cerr << "  JSON subject area: " << json.substr(pos, 80) << std::endl;
        }
    }

    TestUtilities::CleanupTestFiles(tempDir);
    FreeLibrary(hDll);
    return found ? 0 : 1;
}
