# Copyright (C) 2020 Onepanel Inc.
#
# SPDX-License-Identifier: MIT
from pprint import pprint

from django.contrib.auth.models import User
from django.contrib.auth.models import Group
import hashlib
import onepanel.core.api
from onepanel.core.api.rest import ApiException


class OnepanelAuth:
    @staticmethod
    def get_auth_username(request):
        return request.COOKIES['auth-username']

    @staticmethod
    def get_auth_token(request):
        return request.COOKIES['auth-token']

    @staticmethod
    def validate_token(token: str, username: str, onepanel_api_url: str) -> bool:
        if username == '':
            return False
        # Defining the host is optional and defaults to http://localhost:8888
        # See configuration.py for a list of all supported configuration parameters.
        configuration = onepanel.core.api.Configuration(
            host=onepanel_api_url
        )

        # Enter a context with an instance of the API client
        with onepanel.core.api.ApiClient(configuration) as api_client:
            # Create an instance of the API class
            api_instance = onepanel.core.api.AuthServiceApi(api_client)
            body = onepanel.core.api.IsValidTokenRequest()  # IsValidTokenRequest() |
            body.username = username
            body.token = hashlib.md5(token.encode('utf-8')).hexdigest()
            try:
                api_response = api_instance.is_valid_token(body)
                return True
            except ApiException as e:
                print("Exception when calling AuthServiceApi->is_valid_token: %s\n" % e)
                return False


class MirrorOnepanelUser:
    """
    We take the onepanel user credentials, and create the same user in CVAT.
    This helps with auto-login and regular login.
    """
    @staticmethod
    def create_user(request, username=None, auth_token=None):
        """
        :param request: The request from the login page
        :param username: A string that will decide the name of the user
        :param auth_token: A string that is used as the password for the user. This way, the login for Onepanel Web is
        re-used in CVAT.
        """
        if username is None:
            username = OnepanelAuth.get_auth_username(request)
        if auth_token is None:
            auth_token = OnepanelAuth.get_auth_token(request)
        if not User.objects.filter(username=username).exists():
            u = User(username=username)
            u.set_password(auth_token)
            if username == "admin":
                u.is_superuser = True
                u.is_staff = True
            u.save()
            if username != "admin":
                annotator_group = Group.objects.get(name='annotator')
                annotator_group.user_set.add(u)
                annotator_group.save()
                user_group = Group.objects.get(name='user')
                user_group.user_set.add(u)
                user_group.save()
