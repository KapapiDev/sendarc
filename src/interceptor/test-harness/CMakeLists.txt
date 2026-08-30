cmake_minimum_required(VERSION 3.16)
project(SendArc-test-harness)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Create the test harness executable
add_executable(SendArc-test-harness
    test_utils.cpp
    src/main.cpp
    src/test_simple_send.cpp
    src/test_with_attachments.cpp
    src/test_unicode.cpp
    src/test_unicode_wide.cpp
    src/test_multiple_recipients.cpp
    src/test_ansi_encoding.cpp
    src/test_null_filename.cpp
    src/emit_e2e_message.cpp
)

# Include directories (interceptor is now parent directory)
target_include_directories(SendArc-test-harness PRIVATE
    "${CMAKE_CURRENT_SOURCE_DIR}/.."
)

# Platform-specific settings
if(MSVC)
    target_compile_options(SendArc-test-harness PRIVATE /W4 /WX- /guard:cf)
    target_link_options(SendArc-test-harness PRIVATE /guard:cf)
    if(CMAKE_SIZEOF_VOID_P EQUAL 8)
        target_compile_options(SendArc-test-harness PRIVATE /guard:xfg)
        target_link_options(SendArc-test-harness PRIVATE /guard:xfg)
    endif()
    target_link_libraries(SendArc-test-harness PRIVATE kernel32.lib user32.lib shell32.lib)
elseif(MINGW)
    target_compile_options(SendArc-test-harness PRIVATE -Wall -Wextra -Wno-unused-parameter)
    target_link_libraries(SendArc-test-harness PRIVATE kernel32 user32 shell32 -static-libgcc -static-libstdc++)
    target_link_options(SendArc-test-harness PRIVATE -static)
endif()

# Set output directory
set_target_properties(SendArc-test-harness PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin"
)

foreach(SENDARC_CONFIG Debug Release RelWithDebInfo MinSizeRel)
    string(TOUPPER "${SENDARC_CONFIG}" SENDARC_CONFIG_UPPER)
    set_target_properties(SendArc-test-harness PROPERTIES
        "RUNTIME_OUTPUT_DIRECTORY_${SENDARC_CONFIG_UPPER}" "${CMAKE_BINARY_DIR}/bin"
    )
endforeach()
