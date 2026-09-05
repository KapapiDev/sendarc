#include <windows.h>
#include <iostream>
#include <string>
#include <filesystem>
#include <fstream>
#include "../test_utils.h"

using namespace mapi_test;

int test_with_attachments() {
    std::cout << "\nTest: With Attachments" << std::endl;

    // Load the DLL
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

    // Create message with attachments
    char subject[] = "Test Email - With Attachments";
    char body[] = "This email has file attachments.";
    char toAddress[] = "test@example.com";
    char toName[] = "Test User";

    // Create a real temporary attachment. The interceptor copies attachments
    // synchronously before returning, so a nonexistent placeholder path makes
    // this an attachment-failure test instead of a send test.
    std::filesystem::path sourcePath = std::filesystem::temp_directory_path() /
        ("SendArc-harness-" + std::to_string(GetCurrentProcessId()) + "-test.txt");
    {
        std::ofstream source(sourcePath, std::ios::binary | std::ios::trunc);
        source << "test attachment";
        if (!source) {
            std::cerr << "Failed to create temporary attachment" << std::endl;
            FreeLibrary(hDll);
            return 1;
        }
    }
    std::string filePath = sourcePath.u8string();
    char fileName[] = "test.txt";

    MapiFileDesc attachment = {};
    attachment.nPosition = 0;
    attachment.lpszPathName = filePath.data();
    attachment.lpszFileName = fileName;

    MapiRecipDesc recipient = {};
    recipient.ulRecipClass = MAPI_TO;
    recipient.lpszName = toName;
    recipient.lpszAddress = toAddress;

    MapiMessage message = {};
    message.lpszSubject = subject;
    message.lpszNoteText = body;
    message.nRecipCount = 1;
    message.lpRecips = &recipient;
    message.nFileCount = 1;
    message.lpFiles = &attachment;

    // Send the message
    ULONG result = MAPISendMail(0, 0, &message, 0, 0);

    std::cout << "MAPISendMail returned: " << result << std::endl;

    // Verify JSON file was created
    std::string tempDir = TestUtilities::GetSendArcQueueDir();
    bool success = result == SUCCESS_SUCCESS &&
        TestUtilities::VerifyJsonFileCreated(tempDir);

    if (success) {
        std::string jsonPath = TestUtilities::GetNewestJsonPath(tempDir);
        success = !jsonPath.empty() && TestUtilities::ValidateJsonFile(jsonPath);
    }

    std::error_code removeError;
    std::filesystem::remove(sourcePath, removeError);
    FreeLibrary(hDll);
    return success ? 0 : 1;
}
