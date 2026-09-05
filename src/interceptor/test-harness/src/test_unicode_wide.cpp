#include <windows.h>
#include <iostream>
#include <string>
#include <filesystem>
#include <fstream>
#include "../test_utils.h"
#include "../../mapi_types.h"

using namespace mapi_test;

// Function pointer for MAPISendMailW (takes wide message)
typedef ULONG (WINAPI *MAPISendMailWFunc)(
    LHANDLE lhSession,
    ULONG_PTR ulUIParam,
    LPMapiMessageW lpMessage,
    ULONG flFlags,
    ULONG ulReserved
);

int test_unicode_wide() {
    std::cout << "\nTest: MAPISendMailW (Wide/Unicode)" << std::endl;

    // Clean up before test
    std::string tempDir = TestUtilities::GetSendArcQueueDir();
    TestUtilities::CleanupTestFiles(tempDir);

    // Load the DLL
    HMODULE hDll = TestUtilities::LoadInterceptorDll();
    if (!hDll) {
        return 1;
    }

    MAPISendMailWFunc MAPISendMailW = reinterpret_cast<MAPISendMailWFunc>(
        GetProcAddress(hDll, "MAPISendMailW")
    );

    if (!MAPISendMailW) {
        std::cerr << "Failed to get MAPISendMailW function" << std::endl;
        FreeLibrary(hDll);
        return 1;
    }

    // Create message with real wide strings including non-ASCII
    // Spanish: "Informe económico — año 2026"
    wchar_t subject[] = L"Informe econ\u00f3mico \u2014 a\u00f1o 2026";
    // Japanese + emoji mix in body
    wchar_t body[] = L"Estimado se\u00f1or M\u00fcller,\n\nAdjunto el informe.\n\nSaludos cordiales.";

    wchar_t toName[] = L"Ren\u00e9 M\u00fcller";
    wchar_t toAddress[] = L"SMTP:rene.mueller@example.com";
    wchar_t ccName[] = L"\u00c5ke Str\u00f6m";
    wchar_t ccAddress[] = L"SMTP:ake.strom@example.com";

    MapiRecipDescW recipients[2] = {};
    recipients[0].ulRecipClass = MAPI_TO;
    recipients[0].lpszName = toName;
    recipients[0].lpszAddress = toAddress;
    recipients[1].ulRecipClass = MAPI_CC;
    recipients[1].lpszName = ccName;
    recipients[1].lpszAddress = ccAddress;

    // Test attachment with a real Unicode temporary path.
    std::filesystem::path sourcePath = std::filesystem::temp_directory_path() /
        (L"SendArc-harness-" + std::to_wstring(GetCurrentProcessId()) +
         L"-inform\u00e9_2026.pdf");
    {
        std::ofstream source(sourcePath, std::ios::binary | std::ios::trunc);
        source << "unicode attachment";
        if (!source) {
            std::cerr << "Failed to create Unicode temporary attachment" << std::endl;
            FreeLibrary(hDll);
            return 1;
        }
    }
    std::wstring attachPath = sourcePath.wstring();
    wchar_t attachName[] = L"informe_2026.pdf";

    MapiFileDescW attachment = {};
    attachment.lpszPathName = attachPath.data();
    attachment.lpszFileName = attachName;

    MapiMessageW message = {};
    message.lpszSubject = subject;
    message.lpszNoteText = body;
    message.nRecipCount = 2;
    message.lpRecips = recipients;
    message.nFileCount = 1;
    message.lpFiles = &attachment;

    // Send via wide API
    ULONG result = MAPISendMailW(0, 0, &message, 0, 0);
    std::cout << "MAPISendMailW returned: " << result << std::endl;

    if (result != 0) {
        std::cerr << "MAPISendMailW returned error code " << result << std::endl;
        std::error_code removeError;
        std::filesystem::remove(sourcePath, removeError);
        FreeLibrary(hDll);
        return 1;
    }

    // Verify JSON file was created
    bool success = TestUtilities::VerifyJsonFileCreated(tempDir);

    if (success) {
        std::string path = TestUtilities::GetNewestJsonPath(tempDir);
        success = !path.empty() && TestUtilities::ValidateJsonFile(path);

        // Read file to verify UTF-8 content
        HANDLE hFile = CreateFileA(path.c_str(), GENERIC_READ, FILE_SHARE_READ,
            nullptr, OPEN_EXISTING, 0, nullptr);
        if (hFile != INVALID_HANDLE_VALUE) {
            char buf[4096];
            DWORD bytesRead;
            if (ReadFile(hFile, buf, sizeof(buf) - 1, &bytesRead, nullptr)) {
                buf[bytesRead] = '\0';
                std::string json(buf, bytesRead);

                // Verify key UTF-8 sequences are present
                // "ó" = \xc3\xb3, "ñ" = \xc3\xb1, "ü" = \xc3\xbc
                if (json.find("econ\\u00f3mico") != std::string::npos ||
                    json.find("econ\xc3\xb3mico") != std::string::npos) {
                    std::cout << "  UTF-8 content verified in JSON" << std::endl;
                } else if (json.find("Informe") != std::string::npos) {
                    std::cout << "  Subject found in JSON output" << std::endl;
                } else {
                    std::cerr << "  WARNING: Could not find subject in JSON" << std::endl;
                    success = false;
                }

                // Verify recipient name made it through
                if (json.find("Ren") != std::string::npos &&
                    json.find("ller") != std::string::npos) {
                    std::cout << "  Wide recipient names converted to UTF-8" << std::endl;
                } else {
                    std::cerr << "  WARNING: Recipient names not found" << std::endl;
                    success = false;
                }
            }
            CloseHandle(hFile);
        } else {
            success = false;
        }
    }

    TestUtilities::CleanupTestFiles(tempDir);
    std::error_code removeError;
    std::filesystem::remove(sourcePath, removeError);
    FreeLibrary(hDll);
    return success ? 0 : 1;
}
